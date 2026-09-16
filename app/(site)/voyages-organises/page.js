import { getProgramsByFamily } from "@/lib/programs";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import ReassuranceBanner from "@/app/_components/ReassuranceBanner";
import BreadcrumbJsonLd from "@/app/_components/BreadcrumbJsonLd";

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <main className="flex-1 bg-ink">
      <BreadcrumbJsonLd
        items={[{ name: "Accueil", item: baseUrl }, { name: "Voyages organisés" }]}
      />

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">
          Voyages organisés
        </h1>
        <p className="mt-2 font-display text-sm tracking-[0.28em] text-white/60 uppercase">
          Par destination, par envie
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          Envie d&apos;évasion ? Découvrez nos séjours organisés vers de
          nouvelles destinations, par envie ou par destination.
        </p>
      </section>

      <ReassuranceBanner compact dark />

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
          <div>
            <label className="block text-xs tracking-widest text-white/60 uppercase">
              Destination
            </label>
            <input
              type="text"
              name="destination"
              defaultValue={destination || ""}
              placeholder="ex: Turquie"
              className="mt-1 border border-gold/30 bg-ink-soft px-3 py-2.5 text-sm text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest text-white/60 uppercase">
              Envie
            </label>
            <select
              name="envie"
              defaultValue={envie || ""}
              className="mt-1 border border-gold/30 bg-ink-soft px-3 py-2.5 text-sm text-white"
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
            className="bg-gold px-6 py-2.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            Filtrer
          </button>
          {(destination || envie) && (
            <a href="/voyages-organises" className="text-sm text-white/60 hover:text-white">
              Réinitialiser
            </a>
          )}
        </form>

        {dbError && (
          <p className="border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300">
            Impossible de charger les programmes depuis la base de données (
            {dbError}). Vérifiez la configuration MySQL (.env).
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-white/60">
            Aucun voyage organisé publié pour ces critères.
          </p>
        )}

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <HomeShowcaseCard key={program.id} program={program} />
          ))}
        </div>
      </section>
    </main>
  );
}
