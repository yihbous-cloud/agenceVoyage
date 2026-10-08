import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getPublishedNewsBySlug } from "@/lib/news";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { pageAlternates } from "@/lib/i18n/seo";
import { formatDate } from "@/app/_components/formatTrip";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const post = await getPublishedNewsBySlug(slug, agencyRow.id).catch(() => null);

  if (!post) {
    return { title: tr("Article introuvable") };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    alternates: pageAlternates(locale, `/actualites/${slug}`),
  };
}

export default async function NewsDetailPage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const post = await getPublishedNewsBySlug(slug, agencyRow.id).catch(() => null);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    datePublished: post.published_at,
    description: post.excerpt,
    image: post.cover_image_url || undefined,
    publisher: {
      "@type": "Organization",
      name: agencyRow.name,
    },
  };

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="text-xs text-zinc-400">
        {formatDate(post.published_at, INTL_TAGS[locale])}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">{post.title}</h1>
      <div className="mt-6 whitespace-pre-line text-zinc-700">
        {post.content || post.excerpt}
      </div>
    </main>
  );
}
