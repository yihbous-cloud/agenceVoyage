import { notFound } from "next/navigation";
import { getPublishedNewsBySlug } from "@/lib/news";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPublishedNewsBySlug(slug).catch(() => null);

  if (!post) {
    return { title: "Article introuvable" };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
  };
}

export default async function NewsDetailPage({ params }) {
  const { slug } = await params;
  const post = await getPublishedNewsBySlug(slug).catch(() => null);

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
      name: "Golden Fantastic",
    },
  };

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="text-xs text-zinc-400">
        {new Date(post.published_at).toLocaleDateString("fr-FR")}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-zinc-900">{post.title}</h1>
      <div className="mt-6 whitespace-pre-line text-zinc-700">
        {post.content || post.excerpt}
      </div>
    </main>
  );
}
