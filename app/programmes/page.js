import Link from "next/link";
import { getPublishedPrograms } from "@/lib/programs";

export const metadata = {
  title: "Nos programmes de voyage",
  description:
    "Découvrez tous les programmes Omra, Hajj et séjours touristiques proposés par Golden Fantastic.",
};

export const revalidate = 300;

export default async function ProgrammesPage() {
  let programs = [];
  let dbError = null;

  try {
    programs = await getPublishedPrograms();
  } catch (err) {
    dbError = err.message;
  }

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold text-zinc-900">Nos programmes</h1>

      {dbError && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les programmes depuis la base de données ({dbError}).
          Vérifiez la configuration MySQL (.env).
        </p>
      )}

      {!dbError && programs.length === 0 && (
        <p className="mt-6 text-zinc-600">Aucun programme publié pour le moment.</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {programs.map((program) => (
          <Link
            key={program.id}
            href={`/programmes/${program.slug}`}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {program.program_type}
            </span>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900">
              {program.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {program.short_description}
            </p>
            {program.next_departure_date && (
              <p className="mt-4 text-sm font-medium text-zinc-800">
                Prochain départ :{" "}
                {new Date(program.next_departure_date).toLocaleDateString("fr-FR")}
                {program.starting_price &&
                  ` — à partir de ${program.starting_price} ${program.currency}`}
              </p>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
