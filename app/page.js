import Link from "next/link";
import { getPublishedPrograms } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";

export const revalidate = 300;

const REASSURANCE = [
  {
    title: "Accompagnement complet",
    description:
      "Vols, hébergement, transport et visa pris en charge du premier jour au retour.",
  },
  {
    title: "Hôtels proches des lieux saints",
    description:
      "Une sélection d'hôtels à proximité du Haram pour l'Omra et le Hajj.",
  },
  {
    title: "Suivi personnalisé",
    description:
      "Une équipe joignable par WhatsApp pour répondre à vos questions avant et pendant le voyage.",
  },
];

export default async function Home() {
  const [programs, news] = await Promise.all([
    getPublishedPrograms().catch(() => []),
    listPublishedNews().catch(() => []),
  ]);

  const featuredPrograms = programs.slice(0, 3);
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
            href="/programmes"
            className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Voir nos programmes
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Nous contacter
          </Link>
        </div>
      </section>

      {featuredPrograms.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-2xl font-bold text-zinc-900">
            Programmes à la une
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPrograms.map((program) => (
              <Link
                key={program.id}
                href={`/programmes/${program.slug}`}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {program.program_type}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-zinc-900">
                  {program.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  {program.short_description}
                </p>
                {program.next_departure_date && (
                  <p className="mt-4 text-sm font-medium text-zinc-800">
                    Prochain départ :{" "}
                    {new Date(program.next_departure_date).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white py-14">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-2xl font-bold text-zinc-900">
            Pourquoi choisir Golden Fantastic
          </h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {REASSURANCE.map((item) => (
              <div key={item.title}>
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
