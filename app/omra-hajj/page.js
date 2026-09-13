import { getProgramsByFamily } from "@/lib/programs";
import ProgramCard from "../_components/ProgramCard";
import ReassuranceBanner from "../_components/ReassuranceBanner";

export const metadata = {
  title: "Omra & Hajj",
  description:
    "Nos programmes Omra et Hajj : formules par saison du calendrier hégirien, hôtels proches des lieux saints, accompagnement complet.",
};

export const revalidate = 300;

const SEASONS = [
  { value: "mawlid", label: "Mawlid" },
  { value: "rajab", label: "Rajab" },
  { value: "chaabane", label: "Chaabane" },
  { value: "ramadan", label: "Ramadan" },
  { value: "chawal", label: "Chawal" },
];

export default async function OmraHajjPage({ searchParams }) {
  const { saison } = await searchParams;

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByFamily("omra_hajj", { season: saison || undefined });
  } catch (err) {
    dbError = err.message;
  }

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pb-6 pt-12 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Omra &amp; Hajj
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
          Des formules pensées par saison du calendrier hégirien, avec des
          hôtels sélectionnés pour leur proximité avec la Haram.
        </p>
      </section>

      <ReassuranceBanner compact />

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <form className="mb-8 flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="block text-xs font-medium text-zinc-600">
              Saison
            </label>
            <select
              name="saison"
              defaultValue={saison || ""}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Toutes les saisons</option>
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filtrer
          </button>
          {saison && (
            <a
              href="/omra-hajj"
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
            Aucun programme Omra/Hajj publié pour ces critères.
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
