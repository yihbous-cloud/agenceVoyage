import { getProgramsByFamily } from "@/lib/programs";
import { requirePublicAgency } from "@/lib/publicAgency";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import ReassuranceBanner from "@/app/_components/ReassuranceBanner";
import BreadcrumbJsonLd from "@/app/_components/BreadcrumbJsonLd";
import { makeTranslator } from "@/lib/i18n/translate";
import { localizePath } from "@/lib/i18n/locales";
import { pageAlternates, siteBaseUrl } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Omra & Hajj"),
    description: tr(
      "Nos programmes Omra et Hajj : formules par saison du calendrier hégirien, hôtels proches des lieux saints, accompagnement complet."
    ),
    alternates: pageAlternates(locale, "/omra-hajj"),
  };
}

export const revalidate = 300;

const SEASONS = [
  { value: "mawlid", label: "Mawlid" },
  { value: "rajab", label: "Rajab" },
  { value: "chaabane", label: "Chaabane" },
  { value: "ramadan", label: "Ramadan" },
  { value: "chawal", label: "Chawal" },
];

export default async function OmraHajjPage({ params, searchParams }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const { saison } = await searchParams;
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByFamily("omra_hajj", { agencyId: agencyRow.id, season: saison || undefined });
  } catch (err) {
    dbError = err.message;
  }

  const baseUrl = siteBaseUrl(subdomain);

  return (
    <main className="flex-1 bg-cream">
      <BreadcrumbJsonLd
        items={[
          { name: tr("Accueil"), item: `${baseUrl}${localizePath("/", locale)}` },
          { name: tr("Omra & Hajj") },
        ]}
      />

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">{tr("Omra & Hajj")}</h1>
        <p className="mt-2 font-display text-sm tracking-[0.28em] text-muted uppercase">
          {tr("Formules par saison du calendrier hégirien")}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">
          {tr("Des formules pensées par saison du calendrier hégirien, avec des hôtels sélectionnés pour leur proximité avec la Haram.")}
        </p>
      </section>

      <ReassuranceBanner compact />

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
          <div>
            <label className="block text-xs tracking-widest text-muted uppercase">
              {tr("Saison")}
            </label>
            <select
              name="saison"
              defaultValue={saison || ""}
              className="mt-1 border border-gold-pale bg-cream-card px-3 py-2.5 text-sm text-ink"
            >
              <option value="">{tr("Toutes les saisons")}</option>
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {tr(s.label)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-gold px-6 py-2.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            {tr("Filtrer")}
          </button>
          {saison && (
            <a href={localizePath("/omra-hajj", locale)} className="text-sm text-muted hover:text-ink">
              {tr("Réinitialiser")}
            </a>
          )}
        </form>

        {dbError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {tr("Impossible de charger les programmes depuis la base de données")} ({dbError}).{" "}
            {tr("Vérifiez la configuration MySQL (.env).")}
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-muted">
            {tr("Aucun programme Omra/Hajj publié pour ces critères.")}
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
