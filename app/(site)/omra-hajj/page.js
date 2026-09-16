import { getProgramsByFamily } from "@/lib/programs";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import ReassuranceBanner from "@/app/_components/ReassuranceBanner";
import BreadcrumbJsonLd from "@/app/_components/BreadcrumbJsonLd";

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <main className="flex-1 bg-cream">
      <BreadcrumbJsonLd
        items={[{ name: "Accueil", item: baseUrl }, { name: "Omra & Hajj" }]}
      />

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">Omra &amp; Hajj</h1>
        <p className="mt-2 font-display text-sm tracking-[0.28em] text-muted uppercase">
          Formules par saison du calendrier hégirien
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">
          Des formules pensées par saison du calendrier hégirien, avec des
          hôtels sélectionnés pour leur proximité avec la Haram.
        </p>
      </section>

      <ReassuranceBanner compact />

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
          <div>
            <label className="block text-xs tracking-widest text-muted uppercase">
              Saison
            </label>
            <select
              name="saison"
              defaultValue={saison || ""}
              className="mt-1 border border-gold-pale bg-cream-card px-3 py-2.5 text-sm text-ink"
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
            className="bg-gold px-6 py-2.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            Filtrer
          </button>
          {saison && (
            <a href="/omra-hajj" className="text-sm text-muted hover:text-ink">
              Réinitialiser
            </a>
          )}
        </form>

        {dbError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Impossible de charger les programmes depuis la base de données (
            {dbError}). Vérifiez la configuration MySQL (.env).
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-muted">
            Aucun programme Omra/Hajj publié pour ces critères.
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
