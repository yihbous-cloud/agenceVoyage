import { notFound } from "next/navigation";
import { getProgramsByDepartureCity } from "@/lib/programs";
import { getIataBySlug, getCityByIata } from "@/lib/airports";
import ProgramCard from "../../_components/ProgramCard";
import BreadcrumbJsonLd from "../../_components/BreadcrumbJsonLd";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { ville } = await params;
  const iata = getIataBySlug(ville);
  if (!iata) return { title: "Ville introuvable" };

  const city = getCityByIata(iata);
  return {
    title: `Voyages au départ de ${city.city}`,
    description: `Programmes Omra & Hajj et voyages organisés au départ de ${city.city} (${iata}), avec Golden Fantastic.`,
  };
}

// Page pSEO : agrège les deux familles pour une ville de départ donnée
// (dimension orthogonale à /omra-hajj et /voyages-organises, ne remplace
// pas ces URLs — voir PLAN-SEO-GEO-AIO.md §3).
export default async function DepartureCityPage({ params, searchParams }) {
  const { ville } = await params;
  const { famille } = await searchParams;
  const iata = getIataBySlug(ville);

  if (!iata) {
    notFound();
  }

  const city = getCityByIata(iata);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByDepartureCity(iata, {
      family: famille === "omra_hajj" || famille === "voyage_organise" ? famille : undefined,
    });
  } catch (err) {
    dbError = err.message;
  }

  const destinations = [
    ...new Set(programs.map((p) => p.destination_country).filter(Boolean)),
  ];

  return (
    <main className="flex-1">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", item: baseUrl },
          { name: `Départ de ${city.city}` },
        ]}
      />

      <section className="mx-auto max-w-5xl px-6 pb-6 pt-12 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Voyages au départ de {city.city}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
          {programs.length > 0 ? (
            <>
              {programs.length} programme{programs.length > 1 ? "s" : ""} avec un
              départ ouvert depuis l&apos;aéroport de {city.city} ({iata})
              {destinations.length > 0 &&
                `, vers ${destinations.join(", ")}`}
              .
            </>
          ) : (
            <>
              Aucun départ ouvert actuellement depuis {city.city} ({iata}) —
              consultez nos catalogues complets ci-dessous.
            </>
          )}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <form className="mb-8 flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Famille
            </label>
            <select
              name="famille"
              defaultValue={famille || ""}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              <option value="omra_hajj">Omra &amp; Hajj</option>
              <option value="voyage_organise">Voyages organisés</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filtrer
          </button>
        </form>

        {dbError && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Impossible de charger les programmes depuis la base de données (
            {dbError}). Vérifiez la configuration MySQL (.env).
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-zinc-600">
            Aucun programme avec un départ ouvert depuis {city.city} pour le
            moment.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      </section>
    </main>
  );
}
