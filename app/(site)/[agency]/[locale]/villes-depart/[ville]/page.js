import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getProgramsByDepartureCity } from "@/lib/programs";
import { getIataBySlug, getCityByIata } from "@/lib/airports";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import BreadcrumbJsonLd from "@/app/_components/BreadcrumbJsonLd";
import { makeTranslator } from "@/lib/i18n/translate";
import { localizePath } from "@/lib/i18n/locales";
import { pageAlternates, siteBaseUrl } from "@/lib/i18n/seo";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale, ville } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const iata = getIataBySlug(ville);
  if (!iata) return { title: tr("Ville introuvable") };

  const cityName = tr(getCityByIata(iata).city);
  return {
    title: tr("Voyages au départ de {city}", { city: cityName }),
    description: tr(
      "Programmes Omra & Hajj et voyages organisés au départ de {city} ({iata}), avec Golden Fantastic.",
      { city: cityName, iata }
    ),
    alternates: pageAlternates(locale, `/villes-depart/${ville}`),
  };
}

// Page pSEO : agrège les deux familles pour une ville de départ donnée
// (dimension orthogonale à /omra-hajj et /voyages-organises, ne remplace
// pas ces URLs — voir PLAN-SEO-GEO-AIO.md §3).
export default async function DepartureCityPage({ params, searchParams }) {
  const { agency: subdomain, locale, ville } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const { famille } = await searchParams;
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const iata = getIataBySlug(ville);

  if (!iata) {
    notFound();
  }

  const cityName = tr(getCityByIata(iata).city);
  const baseUrl = siteBaseUrl(subdomain);

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByDepartureCity(iata, { agencyId: agencyRow.id,
      family: famille === "omra_hajj" || famille === "voyage_organise" ? famille : undefined,
    });
  } catch (err) {
    dbError = err.message;
  }

  const destinations = [
    ...new Set(programs.map((p) => p.destination_country).filter(Boolean)),
  ].map((d) => tr(d));

  return (
    <main className="flex-1 bg-cream">
      <BreadcrumbJsonLd
        items={[
          { name: tr("Accueil"), item: `${baseUrl}${localizePath("/", locale)}` },
          { name: tr("Départ de {city}", { city: cityName }) },
        ]}
      />

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">
          {tr("Départ de {city}", { city: cityName })}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">
          {programs.length > 0
            ? `${tr.plural(
                "{count} programme avec un départ ouvert depuis l'aéroport de {city} ({iata})",
                "{count} programmes avec un départ ouvert depuis l'aéroport de {city} ({iata})",
                programs.length,
                { city: cityName, iata }
              )}${
                destinations.length > 0
                  ? `${tr(", vers {destinations}", { destinations: destinations.join(", ") })}`
                  : ""
              }.`
            : tr(
                "Aucun départ ouvert actuellement depuis {city} ({iata}) — consultez nos catalogues complets ci-dessous.",
                { city: cityName, iata }
              )}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
          <div>
            <label className="block text-xs tracking-widest text-muted uppercase">
              {tr("Famille")}
            </label>
            <select
              name="famille"
              defaultValue={famille || ""}
              className="mt-1 border border-gold-pale bg-cream-card px-3 py-2.5 text-sm text-ink"
            >
              <option value="">{tr("Toutes")}</option>
              <option value="omra_hajj">{tr("Omra & Hajj")}</option>
              <option value="voyage_organise">{tr("Voyages organisés")}</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-gold px-6 py-2.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            {tr("Filtrer")}
          </button>
        </form>

        {dbError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {tr("Impossible de charger les programmes depuis la base de données")} ({dbError}).{" "}
            {tr("Vérifiez la configuration MySQL (.env).")}
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-muted">
            {tr("Aucun programme avec un départ ouvert depuis {city} pour le moment.", {
              city: cityName,
            })}
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
