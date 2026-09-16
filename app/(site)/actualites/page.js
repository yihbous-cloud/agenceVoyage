import Link from "next/link";
import { listPublishedNews } from "@/lib/news";

export const metadata = {
  title: "Actualités",
  description:
    "Annonces et nouveaux programmes de Golden Fantastic : Omra, Hajj et séjours touristiques.",
};

export const revalidate = 300;

export default async function ActualitesPage() {
  const posts = await listPublishedNews().catch(() => []);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">Actualités</h1>

      {posts.length === 0 && (
        <p className="mt-6 text-zinc-600">Aucune actualité pour le moment.</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/actualites/${post.slug}`}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-xs text-zinc-400">
              {new Date(post.published_at).toLocaleDateString("fr-FR")}
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
