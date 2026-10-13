import { notFound } from "next/navigation";
import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getPublishedGuideBySlug } from "@/lib/guides";
import { getAuthorsByIds } from "@/lib/authors";
import { getProgramsByFamily } from "@/lib/programs";
import { GUIDE_HUB_PATH, GUIDE_PILLAR_LABELS, GUIDE_PILLAR_PATHS, guidePath, authorDisplay } from "@/lib/editorial";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { pageAlternates, buildSocialMetadata, siteBaseUrl } from "@/lib/i18n/seo";
import { canonicalLocaleFor } from "@/lib/i18n/contentLocale";
import { plainSummary } from "@/lib/markdown";
import { articleNode, personNode, personId } from "@/lib/seo/jsonLd";
import { formatDate } from "@/app/_components/formatTrip";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import RichText from "@/app/_components/RichText";
import PageJsonLd from "@/app/_components/PageJsonLd";
import AuthorBox from "@/app/_components/AuthorBox";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";

// Guide (référencement, vague 2B — CLAUDE.md §3centdixhuitquadragies) :
// contenu de fond signé, daté, relu (référent religieux pour un contenu
// religieux), relié à son pilier et à l'offre la plus proche.
export const revalidate = 300;

// Mis en cache à la première visite puis régénéré toutes les 5 min (ISR).
export async function generateStaticParams() {
  return [];
}

async function loadGuide(subdomain, slug, locale) {
  const agencyRow = await requirePublicAgency(subdomain);
  const guide = await getPublishedGuideBySlug(slug, agencyRow.id, locale).catch(() => null);
  return { agencyRow, guide };
}

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, guide } = await loadGuide(subdomain, slug, locale);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  if (!guide) return { title: tr("Guide introuvable") };
  const alternates = pageAlternates(locale, guidePath(guide.slug), { availableLocales: guide.available_locales });
  const description = guide.meta_description || plainSummary(guide.excerpt || guide.content);
  return {
    title: guide.meta_title ? { absolute: guide.meta_title } : guide.title,
    description,
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: guide.meta_title || guide.title,
      description,
      url: alternates.canonical,
      image: guide.cover_image_url,
      logoUrl: agencyRow.logo_url,
      type: "article",
    }),
  };
}

// Offre la plus proche du pilier du guide (prochain départ ouvert).
async function nearestOffer(pillar, agencyId, locale) {
  if (pillar === "omra" || pillar === "hajj") {
    const [program] = await getProgramsByFamily("omra_hajj", {
      agencyId,
      programType: pillar === "hajj" ? "hajj" : "not_hajj",
      locale,
      limit: 1,
    });
    return program?.next_departure_date ? program : null;
  }
  if (pillar === "voyages") {
    const [program] = await getProgramsByFamily("voyage_organise", { agencyId, locale, limit: 1 });
    return program?.next_departure_date ? program : null;
  }
  return null;
}

export default async function GuidePage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, guide } = await loadGuide(subdomain, slug, locale);
  if (!guide) notFound();
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  const [authors, offer] = await Promise.all([
    getAuthorsByIds([guide.author_id, guide.reviewer_id], agencyRow.id).catch(() => ({})),
    nearestOffer(guide.pillar, agencyRow.id, locale).catch(() => null),
  ]);
  const author = guide.author_id ? authors[guide.author_id] : null;
  const reviewer = guide.reviewer_id ? authors[guide.reviewer_id] : null;
  const authorName = authorDisplay(author, locale)?.name;
  const reviewerName = authorDisplay(reviewer, locale)?.name;
  const pillarPath = GUIDE_PILLAR_PATHS[guide.pillar];
  const pillarLabel = tr(GUIDE_PILLAR_LABELS[guide.pillar] || GUIDE_PILLAR_LABELS.general);
  const description = plainSummary(guide.excerpt || guide.content, 300);
  const updatedAt = guide.updated_at || guide.published_at;

  const breadcrumb = [
    { name: tr("Accueil"), href: "/" },
    { name: tr("Guides pratiques"), href: GUIDE_HUB_PATH },
    { name: guide.title },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path={guidePath(guide.slug)}
        canonicalLocale={canonicalLocaleFor(locale, guide)}
        name={guide.meta_title || guide.title}
        description={description}
        breadcrumb={breadcrumb}
        mainEntity="article"
        dateModified={updatedAt}
        reviewedBy={reviewer ? { "@id": personId(siteBaseUrl(agencyRow.subdomain), reviewer.id) } : undefined}
        lastReviewed={reviewer && guide.reviewed_at ? guide.reviewed_at : undefined}
        nodes={(url, baseUrl) => [
          articleNode({
            guide,
            url,
            baseUrl,
            description,
            locale: canonicalLocaleFor(locale, guide) || locale,
            authorId: author?.id,
          }),
          personNode({ author, display: authorDisplay(author, locale), baseUrl }),
          reviewer && reviewer.id !== author?.id ? personNode({ author: reviewer, display: authorDisplay(reviewer, locale), baseUrl }) : null,
        ]}
      />
      <Breadcrumbs className="mb-6" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />

      {pillarPath ? (
        <Link href={pillarPath} className="text-xs font-semibold tracking-wide text-[#A8863C] uppercase hover:underline">
          {pillarLabel}
        </Link>
      ) : (
        <span className="text-xs font-semibold tracking-wide text-[#A8863C] uppercase">{pillarLabel}</span>
      )}
      <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{guide.title}</h1>
      <p className="mt-3 text-sm text-muted">
        {authorName && <span>{tr("Par {name}", { name: authorName })} · </span>}
        {reviewerName && <span>{tr("Relu par {name}", { name: reviewerName })} · </span>}
        <span>{tr("Mis à jour le {date}", { date: formatDate(updatedAt, INTL_TAGS[locale]) })}</span>
      </p>
      {guide.excerpt && <p className="mt-6 text-lg text-ink">{guide.excerpt}</p>}
      {guide.content && <RichText className="mt-6 text-zinc-700" text={guide.content} />}

      <AuthorBox author={author} reviewer={reviewer} reviewedAt={guide.reviewed_at} locale={locale} tr={tr} />

      {offer && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-ink">{tr("Notre prochain départ")}</h2>
          <div className="mt-4 max-w-sm">
            <HomeShowcaseCard program={offer} />
          </div>
          {pillarPath && (
            <Link href={pillarPath} className="mt-4 inline-block text-sm text-[#A8863C] hover:underline">
              {tr("Voir tous nos programmes {pillar}", { pillar: pillarLabel })}
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

