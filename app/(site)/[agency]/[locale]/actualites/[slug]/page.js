import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getPublishedNewsBySlug } from "@/lib/news";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS, localizePath } from "@/lib/i18n/locales";
import { pageAlternates, siteBaseUrl, buildSocialMetadata } from "@/lib/i18n/seo";
import { newsContentLocale } from "@/lib/i18n/contentLocale";
import { plainSummary } from "@/lib/markdown";
import { formatDate } from "@/app/_components/formatTrip";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import RichText from "@/app/_components/RichText";

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
  const post = await getPublishedNewsBySlug(slug, agencyRow.id).catch(() => null);

  if (!post) {
    return { title: tr("Article introuvable") };
  }

  // Article saisi dans une seule langue : canonical vers celle-ci, sans
  // hreflang (lib/i18n/contentLocale.js, CLAUDE.md §3centtreizequadragies).
  const alternates = pageAlternates(locale, `/actualites/${slug}`, {
    contentLocale: newsContentLocale(post),
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
  const post = await getPublishedNewsBySlug(slug, agencyRow.id).catch(() => null);

  if (!post) {
    notFound();
  }

  const baseUrl = siteBaseUrl(subdomain);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    url: `${baseUrl}${localizePath(`/actualites/${slug}`, locale)}`,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    description: plainSummary(post.excerpt || post.content, 300) || undefined,
    image: post.cover_image_url ? new URL(post.cover_image_url, baseUrl).toString() : undefined,
    publisher: {
      "@type": "Organization",
      name: agencyRow.name,
      url: baseUrl,
    },
  };

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs
        className="mb-6"
        locale={locale}
        baseUrl={baseUrl}
        label={tr("Fil d'Ariane")}
        items={[
          { name: tr("Accueil"), href: "/" },
          { name: tr("Actualités"), href: "/actualites" },
          { name: post.title },
        ]}
      />

      <p className="text-xs text-zinc-400">
        {formatDate(post.published_at, INTL_TAGS[locale])}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">{post.title}</h1>
      <RichText className="mt-6 text-zinc-700" text={post.content || post.excerpt} />
    </main>
  );
}
