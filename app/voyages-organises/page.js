import { getProgramsByFamily } from "@/lib/programs";
import ProgramCard from "../_components/ProgramCard";
import ReassuranceBanner from "../_components/ReassuranceBanner";

export const metadata = {
  title: "Voyages organisés",
  description:
    "Nos séjours et voyages organisés : plage, culture, aventure, famille, couple — partez à la découverte de nouvelles destinations.",
};

export const revalidate = 300;

const ENVIES = [
  { value: "plage", label: "Plage" },
  { value: "culture", label: "Culture" },
  { value: "aventure", label: "Aventure" },
  { value: "famille", label: "Famille" },
  { value: "couple", label: "Couple" },
];

export default async function VoyagesOrganisesPage({ searchParams }) {
  const { destination, envie } = await searchParams;

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByFamily("voyage_organise", {
      destination: destination || undefined,
      theme: envie || undefined,
    });
  } catch (err) {
    dbError = err.message;
  }

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-6 pt-12 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Voyages organisés
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
          Envie d&apos;évasion ? Découvrez nos séjours organisés vers de
          nouvelles destinations, par envie ou par destination.
        </p>
      </section>

      <ReassuranceBanner compact />

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <form className="mb-8 flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Destination
            </label>
            <input
              type="text"
              name="destination"
              defaultValue={destination || ""}
              placeholder="ex: Turquie"
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Envie
            </label>
            <select
              name="envie"
              defaultValue={envie || ""}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Toutes les envies</option>
              {ENVIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Filtrer
          </button>
          {(destination || envie) && (
            <a
              href="/voyages-organises"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Réinitialiser
            </a>
          )}
        </form>

        {dbError && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Impossible de charger les programmes depuis la base de données (
            {dbError}). Vérifiez la configuration MySQL (.env).
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-zinc-600">
            Aucun voyage organisé publié pour ces critères.
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
