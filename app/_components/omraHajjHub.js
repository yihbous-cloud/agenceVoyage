import { getProgramsByFamily } from "@/lib/programs";
import { requirePublicAgency } from "@/lib/publicAgency";
import HomeShowcaseCard from "./HomeShowcaseCard";
import ReassuranceBanner from "./ReassuranceBanner";
import Breadcrumbs from "./Breadcrumbs";
import PageJsonLd from "./PageJsonLd";
import { itemListNode, faqNode } from "@/lib/seo/jsonLd";
import { listPublishedGuides } from "@/lib/guides";
import { listSiteQuestions } from "@/lib/ai/knowledge";
import { GUIDE_HUB_PATH } from "@/lib/editorial";
import GuideCards from "./GuideCards";
import QuestionList from "./QuestionList";
import Link from "./LocalizedLink";
import { programPath } from "@/lib/programUrls";
import { makeTranslator } from "@/lib/i18n/translate";
import { localizePath } from "@/lib/i18n/locales";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { PILLAR_PATHS } from "@/lib/programUrls";

// Piliers publics /omra et /hajj (CLAUDE.md §3centtreizequadragies, décision
// D2 — remplacent l'ancien hub commun /omra-hajj). Même gabarit, textes et
// filtre propres à chaque pilier : la saison du calendrier hégirien n'a de
// sens que pour l'Omra (le Hajj n'a qu'une période dans l'année).
// Textes sources en français, traduits à l'affichage par tr().
const PILLARS = {
  omra: {
    path: PILLAR_PATHS.omra,
    heading: "Omra",
    metaTitle: "Omra depuis le Maroc",
    metaDescription:
      "Nos programmes Omra au départ du Maroc : formules par saison du calendrier hégirien, hôtels proches du Haram, visa et accompagnement inclus.",
    tagline: "Formules par saison du calendrier hégirien",
    intro:
      "Des formules pensées par saison du calendrier hégirien, avec des hôtels sélectionnés pour leur proximité avec la Haram.",
    empty: "Aucun programme Omra publié pour ces critères.",
    programType: "not_hajj",
    seasonFilter: true,
  },
  hajj: {
    path: PILLAR_PATHS.hajj,
    heading: "Hajj",
    metaTitle: "Hajj depuis le Maroc",
    metaDescription:
      "Nos programmes Hajj au départ du Maroc : formules, hôtels proches des lieux saints, accompagnement complet du départ au retour.",
    tagline: "Le pèlerinage accompagné, du départ au retour",
    intro:
      "Des programmes Hajj encadrés de bout en bout : formalités, vols, hôtels proches des lieux saints et accompagnement religieux.",
    empty: "Aucun programme Hajj publié pour le moment.",
    programType: "hajj",
    seasonFilter: false,
  },
};

const SEASONS = [
  { value: "mawlid", label: "Mawlid" },
  { value: "rajab", label: "Rajab" },
  { value: "chaabane", label: "Chaabane" },
  { value: "ramadan", label: "Ramadan" },
  { value: "chawal", label: "Chawal" },
];

export async function omraHajjHubMetadata(params, pillarKey) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const pillar = PILLARS[pillarKey];
  const title = tr(pillar.metaTitle);
  const description = tr(pillar.metaDescription);
  const alternates = pageAlternates(locale, pillar.path);
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

export async function renderOmraHajjHub(params, searchParams, pillarKey) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const pillar = PILLARS[pillarKey];
  // searchParams n'est lu que pour le pilier qui a un filtre (Omra) : y
  // accéder rendrait la page dynamique, le pilier Hajj reste ainsi en cache.
  const season = pillar.seasonFilter ? ((await searchParams) || {}).saison : undefined;
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  let programs = [];
  let dbError = null;
  try {
    programs = await getProgramsByFamily("omra_hajj", {
      agencyId: agencyRow.id,
      programType: pillar.programType,
      season: season || undefined,
      locale,
    });
  } catch (err) {
    dbError = err.message;
  }

  // Guides et questions du pilier (vague 2B du référencement) : banque de
  // questions partagée avec l'agent WhatsApp (ia_knowledge, page = pilier).
  const [guides, questions] = await Promise.all([
    listPublishedGuides({ pillar: pillarKey, limit: 6 }, agencyRow.id, locale).catch(() => []),
    listSiteQuestions(pillarKey, agencyRow.id, locale).catch(() => []),
  ]);

  const breadcrumb = [{ name: tr("Accueil"), href: "/" }, { name: tr(pillar.heading) }];

  return (
    <main className="flex-1 bg-cream">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path={pillar.path}
        name={tr(pillar.metaTitle)}
        description={tr(pillar.metaDescription)}
        pageType="CollectionPage"
        breadcrumb={breadcrumb}
        mainEntity={programs.length > 0 ? "list" : undefined}
        nodes={(url, baseUrl) => [
          itemListNode(
            url,
            programs.map((p) => ({ name: p.title, url: `${baseUrl}${localizePath(programPath(p), locale)}` }))
          ),
          faqNode(url, questions),
        ]}
      />
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Breadcrumbs locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />
      </div>

      <section className="mx-auto max-w-3xl px-6 pt-10 pb-6 text-center">
        <h1 className="font-script text-6xl leading-none text-gold">{tr(pillar.heading)}</h1>
        <p className="mt-2 font-display text-sm tracking-[0.28em] text-muted uppercase">
          {tr(pillar.tagline)}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">{tr(pillar.intro)}</p>
      </section>

      <ReassuranceBanner compact />

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        {pillar.seasonFilter && (
          <form className="mb-10 flex flex-wrap items-end justify-center gap-3" method="get">
            <div>
              <label className="block text-xs tracking-widest text-muted uppercase">
                {tr("Saison")}
              </label>
              <select
                name="saison"
                defaultValue={season || ""}
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
            {season && (
              <a href={localizePath(pillar.path, locale)} className="text-sm text-muted hover:text-ink">
                {tr("Réinitialiser")}
              </a>
            )}
          </form>
        )}

        {dbError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {tr("Impossible de charger les programmes depuis la base de données")} ({dbError}).{" "}
            {tr("Vérifiez la configuration MySQL (.env).")}
          </p>
        )}

        {!dbError && programs.length === 0 && (
          <p className="text-center text-muted">{tr(pillar.empty)}</p>
        )}

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <HomeShowcaseCard key={program.id} program={program} />
          ))}
        </div>
      </section>

      {questions.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="font-display text-2xl text-ink">{tr("Questions fréquentes")}</h2>
          <div className="mt-6">
            <QuestionList items={questions} tr={tr} />
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="font-display text-2xl text-ink">{tr("Guides pratiques")}</h2>
          <div className="mt-6">
            <GuideCards guides={guides} locale={locale} tr={tr} showPillar={false} />
          </div>
          <Link href={GUIDE_HUB_PATH} className="mt-6 inline-block text-sm text-[#A8863C] hover:underline">
            {tr("Tous nos guides")}
          </Link>
        </section>
      )}
    </main>
  );
}
