import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getPublishedNewsBySlug } from "@/lib/news";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { canonicalLocaleFor } from "@/lib/i18n/contentLocale";
import { plainSummary } from "@/lib/markdown";
import { newsArticleNode } from "@/lib/seo/jsonLd";
import { formatDate } from "@/app/_components/formatTrip";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import RichText from "@/app/_components/RichText";
import PageJsonLd from "@/app/_components/PageJsonLd";

export const revalidate = 300;

// Mis en cache à la première visite puis régénéré toutes les 5 min (ISR) :
// sans cette fonction, la page serait rendue à chaque requête.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const post = await getPublishedNewsBySlug(slug, agencyRow.id, locale).catch(() => null);

  if (!post) {
    return { title: tr("Article introuvable") };
  }

  // Canonical et hreflang selon les langues dans lesquelles l'article existe
  // réellement (vague 1B, CLAUDE.md §3centquinzequadragies).
  const alternates = pageAlternates(locale, `/actualites/${slug}`, {
    availableLocales: post.available_locales,
  });
  const description = post.meta_description || plainSummary(post.excerpt || post.content);

  return {
    title: post.meta_title ? { absolute: post.meta_title } : post.title,
    description,
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: post.meta_title || post.title,
      description,
      url: alternates.canonical,
      image: post.cover_image_url,
      logoUrl: agencyRow.logo_url,
      type: "article",
    }),
  };
}

export default async function NewsDetailPage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const post = await getPublishedNewsBySlug(slug, agencyRow.id, locale).catch(() => null);

  if (!post) {
    notFound();
  }

  const description = plainSummary(post.excerpt || post.content, 300);
  const breadcrumb = [
    { name: tr("Accueil"), href: "/" },
    { name: tr("Actualités"), href: "/actualites" },
    { name: post.title },
  ];

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path={`/actualites/${slug}`}
        canonicalLocale={canonicalLocaleFor(locale, post)}
        name={post.meta_title || post.title}
        description={description}
        breadcrumb={breadcrumb}
        mainEntity="article"
        dateModified={post.updated_at || post.published_at}
        nodes={(url, baseUrl) => [newsArticleNode({ post, url, baseUrl, description })]}
      />
      <Breadcrumbs className="mb-6" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />

      <p className="text-xs text-zinc-400">
        {formatDate(post.published_at, INTL_TAGS[locale])}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">{post.title}</h1>
      <RichText className="mt-6 text-zinc-700" text={post.content || post.excerpt} />
    </main>
  );
}
