import { getProgramsByFamily } from "@/lib/programs";
import { requirePublicAgency } from "@/lib/publicAgency";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import ReassuranceBanner from "@/app/_components/ReassuranceBanner";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import PageJsonLd from "@/app/_components/PageJsonLd";
import { itemListNode, faqNode } from "@/lib/seo/jsonLd";
import { listPublishedGuides } from "@/lib/guides";
import { listSiteQuestions } from "@/lib/ai/knowledge";
import { GUIDE_HUB_PATH } from "@/lib/editorial";
import GuideCards from "@/app/_components/GuideCards";
import QuestionList from "@/app/_components/QuestionList";
import Link from "@/app/_components/LocalizedLink";
import { programPath } from "@/lib/programUrls";
import { makeTranslator } from "@/lib/i18n/translate";
import { localizePath } from "@/lib/i18n/locales";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const title = tr("Voyages organisés");
  const description = tr(
    "Nos séjours et voyages organisés : plage, culture, aventure, famille, couple — partez à la découverte de nouvelles destinations."
  );
  const alternates = pageAlternates(locale, "/voyages-organises");
  return {
    title,
    description,
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title,
      description,
      url: alternates.canonical,
      logoUrl: agencyRow.logo_url,
    }),
  };
}

export const revalidate = 300;

const ENVIES = [
  { value: "plage", label: "Plage" },
  { value: "culture", label: "Culture" },
  { value: "aventure", label: "Aventure" },
  { value: "famille", label: "Famille" },
  { value: "couple", label: "Couple" },
];

export default async function VoyagesOrganisesPage({ params, searchParams }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const { destination, envie } = await searchParams;
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByFamily("voyage_organise", { agencyId: agencyRow.id,
      destination: destination || undefined,
      theme: envie || undefined,
      locale,
    });
  } catch (err) {
    dbError = err.message;
  }

  // Guides et questions du pilier (vague 2B du référencement).
  const [guides, questions] = await Promise.all([
    listPublishedGuides({ pillar: "voyages", limit: 6 }, agencyRow.id, locale).catch(() => []),
    listSiteQuestions("voyages", agencyRow.id, locale).catch(() => []),
  ]);

  const breadcrumb = [{ name: tr("Accueil"), href: "/" }, { name: tr("Voyages organisés") }];

  return (
    <main className="flex-1 bg-ink">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path="/voyages-organises"
        name={tr("Voyages organisés")}
        pageType="CollectionPage"
        breadcrumb={breadcrumb}
        mainEntity={programs.length > 0 ? "list" : undefined}
        nodes={(url, siteUrl) => [
          itemListNode(
            url,
            programs.map((p) => ({ name: p.title, url: `${siteUrl}${localizePath(programPath(p), locale)}` }))
          ),
          faqNode(url, questions),
        ]}
      />
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Breadcrumbs tone="dark" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />
      </div>

      <section className="mx-auto max-w-3xl px-6 pt-10 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">
          {tr("Voyages organisés")}
        </h1>
        <p className="mt-2 font-display text-sm tracking-[0.28em] text-white/60 uppercase">
          {tr("Par destination, par envie")}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          {tr("Envie d'évasion ? Découvrez nos séjours organisés vers de nouvelles destinations, par envie ou par destination.")}
        </p>
      </section>

      <ReassuranceBanner compact dark />

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
          <div>
            <label className="block text-xs tracking-widest text-white/60 uppercase">
              {tr("Destination")}
            </label>
            <input
              type="text"
              name="destination"
              defaultValue={destination || ""}
              placeholder={tr("ex: Turquie")}
              className="mt-1 border border-gold/30 bg-ink-soft px-3 py-2.5 text-sm text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest text-white/60 uppercase">
              {tr("Envie")}
            </label>
            <select
              name="envie"
              defaultValue={envie || ""}
              className="mt-1 border border-gold/30 bg-ink-soft px-3 py-2.5 text-sm text-white"
            >
              <option value="">{tr("Toutes les envies")}</option>
              {ENVIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {tr(e.label)}
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
          {(destination || envie) && (
            <a
              href={localizePath("/voyages-organises", locale)}
              className="text-sm text-white/60 hover:text-white"
            >
              {tr("Réinitialiser")}
            </a>
          )}
        </form>

        {dbError && (
          <p className="border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300">
            {tr("Impossible de charger les programmes depuis la base de données")} ({dbError}).{" "}
            {tr("Vérifiez la configuration MySQL (.env).")}
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-white/60">
            {tr("Aucun voyage organisé publié pour ces critères.")}
          </p>
        )}

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <HomeShowcaseCard key={program.id} program={program} />
          ))}
        </div>
      </section>

      {questions.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="font-display text-2xl text-white">{tr("Questions fréquentes")}</h2>
          <div className="mt-6">
            <QuestionList items={questions} tr={tr} />
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="font-display text-2xl text-white">{tr("Guides pratiques")}</h2>
          <div className="mt-6">
            <GuideCards guides={guides} locale={locale} tr={tr} showPillar={false} />
          </div>
          <Link href={GUIDE_HUB_PATH} className="mt-6 inline-block text-sm text-gold hover:underline">
            {tr("Tous nos guides")}
          </Link>
        </section>
      )}
    </main>
  );
}
