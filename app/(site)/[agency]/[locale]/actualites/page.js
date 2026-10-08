import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { listPublishedNews } from "@/lib/news";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { pageAlternates } from "@/lib/i18n/seo";
import { formatDate } from "@/app/_components/formatTrip";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Actualités"),
    description: tr(
      "Annonces et nouveaux programmes de Golden Fantastic : Omra, Hajj et séjours touristiques."
    ),
    alternates: pageAlternates(locale, "/actualites"),
  };
}

export const revalidate = 300;

export default async function ActualitesPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const posts = await listPublishedNews(agencyRow.id).catch(() => []);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold text-zinc-900">{tr("Actualités")}</h1>

      {posts.length === 0 && (
        <p className="mt-6 text-zinc-600">{tr("Aucune actualité pour le moment.")}</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/actualites/${post.slug}`}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-xs text-zinc-400">
              {formatDate(post.published_at, INTL_TAGS[locale])}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
