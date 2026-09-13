import Link from "next/link";
import { getProgramsByFamily } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";
import ProgramCard from "./_components/ProgramCard";
import ReassuranceBanner from "./_components/ReassuranceBanner";

export const revalidate = 300;

export default async function Home() {
  const [omraHajjPrograms, voyagePrograms, news] = await Promise.all([
    getProgramsByFamily("omra_hajj", { limit: 3 }).catch(() => []),
    getProgramsByFamily("voyage_organise", { limit: 3 }).catch(() => []),
    listPublishedNews().catch(() => []),
  ]);

  const latestNews = news.slice(0, 3);

  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Golden Fantastic
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600">
          Omra, Hajj et séjours touristiques organisés. Découvrez nos prochains
          départs et réservez votre place en ligne.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/omra-hajj"
            className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Omra &amp; Hajj
          </Link>
          <Link
            href="/voyages-organises"
            className="rounded-full bg-amber-600 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-700"
          >
            Voyages organisés
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Nous contacter
          </Link>
        </div>
      </section>

      {omraHajjPrograms.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-900">Omra &amp; Hajj</h2>
            <Link href="/omra-hajj" className="text-sm font-medium text-emerald-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {omraHajjPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      )}

      {voyagePrograms.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-900">Voyages organisés</h2>
            <Link href="/voyages-organises" className="text-sm font-medium text-amber-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {voyagePrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      )}

      <ReassuranceBanner />

      {latestNews.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-900">Actualités</h2>
            <Link href="/actualites" className="text-sm font-medium text-emerald-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {latestNews.map((post) => (
              <Link
                key={post.id}
                href={`/actualites/${post.slug}`}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-semibold text-zinc-900">{post.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
