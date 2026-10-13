import { notFound } from "next/navigation";
import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { listPublishedGuides } from "@/lib/guides";
import { glossaryLocales } from "@/lib/glossary";
import { GUIDE_PILLARS, GUIDE_PILLAR_LABELS, GUIDE_HUB_PATH, GLOSSARY_PATH, guidePath } from "@/lib/editorial";
import { makeTranslator } from "@/lib/i18n/translate";
import { localizePath } from "@/lib/i18n/locales";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { itemListNode } from "@/lib/seo/jsonLd";
import PageJsonLd from "@/app/_components/PageJsonLd";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import GuideCards from "@/app/_components/GuideCards";

// Hub des guides (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies) : guides publiés regroupés par pilier, lien vers
// le lexique. N'existe pas tant qu'aucun guide n'est publié (pas de page
// vide indexée).
export const revalidate = 300;

const TITLE = "Guides pratiques";
const DESCRIPTION =
  "Nos guides pour préparer votre Omra, votre Hajj ou votre voyage : formalités, rites, santé, bagages et conseils de nos accompagnateurs.";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const alternates = pageAlternates(locale, GUIDE_HUB_PATH);
  return {
    title: tr(TITLE),
    description: tr(DESCRIPTION),
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: tr(TITLE),
      description: tr(DESCRIPTION),
      url: alternates.canonical,
      logoUrl: agencyRow.logo_url,
    }),
  };
}

export default async function GuideHubPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const [guides, lexiconLocales] = await Promise.all([
    listPublishedGuides({}, agencyRow.id, locale).catch(() => []),
    glossaryLocales(agencyRow.id).catch(() => []),
  ]);
  if (guides.length === 0) notFound();

  const hasLexicon = lexiconLocales.includes(locale === "ar" ? "ar" : "fr");
  const breadcrumb = [{ name: tr("Accueil"), href: "/" }, { name: tr(TITLE) }];
  const sections = GUIDE_PILLARS.map((pillar) => ({ pillar, guides: guides.filter((g) => g.pillar === pillar) })).filter(
    (s) => s.guides.length > 0
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path={GUIDE_HUB_PATH}
        name={tr(TITLE)}
        description={tr(DESCRIPTION)}
        pageType="CollectionPage"
        breadcrumb={breadcrumb}
        mainEntity="list"
        nodes={(url, baseUrl) => [
          itemListNode(
            url,
            guides.map((g) => ({ name: g.title, url: `${baseUrl}${localizePath(guidePath(g.slug), locale)}` }))
          ),
        ]}
      />
      <Breadcrumbs className="mb-6" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{tr(TITLE)}</h1>
      <p className="mt-3 max-w-3xl text-muted">{tr(DESCRIPTION)}</p>
      {hasLexicon && (
        <p className="mt-4">
          <Link href={GLOSSARY_PATH} className="text-sm text-[#A8863C] hover:underline">
            {tr("Lexique : les mots de la Omra, du Hajj et du voyage")}
          </Link>
        </p>
      )}

      {sections.map((section) => (
        <section key={section.pillar} className="mt-12">
          <h2 className="font-display text-xl text-ink">{tr(GUIDE_PILLAR_LABELS[section.pillar])}</h2>
          <div className="mt-4">
            <GuideCards guides={section.guides} locale={locale} tr={tr} showPillar={false} />
          </div>
        </section>
      ))}
    </main>
  );
}
