import { getProgramsByFamily, getDepartureCities } from "@/lib/programs";
import { citySlug } from "@/lib/airports";
import { getCurrentAgency } from "@/lib/currentAgency";
import { programPath, programPillar } from "@/lib/programUrls";
import { plainSummary } from "@/lib/markdown";
import { localizePath } from "@/lib/i18n/locales";
import { indexedAvailableLocales } from "@/lib/i18n/contentLocale";
import { listPublishedGuides } from "@/lib/guides";
import { glossaryInfo } from "@/lib/glossary";
import { GUIDE_HUB_PATH, GLOSSARY_PATH, guidePath } from "@/lib/editorial";

const LANGUAGE_NAMES = { ar: "arabe", fr: "française" };

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Une ligne Markdown par programme (dans sa langue principale, vers son URL
// canonique), puis une ligne par autre langue réellement traduite (vague 1B).
// La description saisie dans l'admin peut contenir du Markdown et des sauts
// de ligne : elle est ramenée à un résumé en texte brut sur une ligne.
// `byLocale` : { ar: Map(id → programme en arabe), fr: Map(...) }.
function programLines(baseUrl, program, byLocale) {
  const [principal, ...others] = indexedAvailableLocales(program);
  const main = byLocale[principal]?.get(program.id) || program;
  const summary = plainSummary(main.short_description, 200);
  const lines = [
    `- [${main.title}](${baseUrl}${localizePath(programPath(program), principal)})${summary ? `: ${summary}` : ""}`,
  ];
  for (const locale of others) {
    const version = byLocale[locale]?.get(program.id);
    if (version) {
      lines.push(`  - Version ${LANGUAGE_NAMES[locale] || locale} : [${version.title}](${baseUrl}${localizePath(programPath(program), locale)})`);
    }
  }
  return lines;
}

export async function GET() {
  const { baseUrl, name: brand } = await getCurrentAgency();
  const [guides, glossary] = await Promise.all([
    listPublishedGuides().catch(() => []),
    glossaryInfo().catch(() => ({ locales: [] })),
  ]);
  const [omraHajjPrograms, voyagePrograms, departureCities, arPrograms, frPrograms] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    getDepartureCities().catch(() => []),
    Promise.all([getProgramsByFamily("omra_hajj", { locale: "ar" }), getProgramsByFamily("voyage_organise", { locale: "ar" })]).then((l) => l.flat()).catch(() => []),
    Promise.all([getProgramsByFamily("omra_hajj", { locale: "fr" }), getProgramsByFamily("voyage_organise", { locale: "fr" })]).then((l) => l.flat()).catch(() => []),
  ]);
  const byLocale = {
    ar: new Map(arPrograms.map((p) => [p.id, p])),
    fr: new Map(frPrograms.map((p) => [p.id, p])),
  };
  const omraPrograms = omraHajjPrograms.filter((p) => programPillar(p) === "omra");
  const hajjPrograms = omraHajjPrograms.filter((p) => programPillar(p) === "hajj");

  const section = (title, programs) =>
    programs.length > 0 ? [`## ${title}`, "", ...programs.flatMap((p) => programLines(baseUrl, p, byLocale)), ""] : [];

  const lines = [
    `# ${brand}`,
    "",
    "> Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques au départ du Maroc.",
    "",
    `${brand} organise des programmes Omra et Hajj vers l'Arabie Saoudite (hôtels proches des lieux saints, visa et accompagnement inclus) ainsi que des voyages organisés vers d'autres destinations (plage, culture, aventure, famille, couple).`,
    "",
    ...section("Omra", omraPrograms),
    ...section("Hajj", hajjPrograms),
    ...section("Voyages organisés", voyagePrograms),
    ...(departureCities.length > 0
      ? [
          "## Villes de départ",
          "",
          ...departureCities.map(
            (c) => `- [Départ de ${c.city}](${baseUrl}/villes-depart/${citySlug(c.city)})`
          ),
          "",
        ]
      : []),
    // Guides (vague 2B) : contenus de fond, dans leur langue principale.
    ...(guides.length > 0
      ? [
          "## Guides pratiques",
          "",
          ...guides.map((g) => {
            const [principal] = indexedAvailableLocales(g);
            const summary = plainSummary(g.excerpt || g.content, 200);
            return `- [${g.title}](${baseUrl}${localizePath(guidePath(g.slug), principal)})${summary ? `: ${summary}` : ""}`;
          }),
          "",
        ]
      : []),
    "## Langues",
    "",
    `- Arabe (langue principale) : ${baseUrl}/`,
    `- Français : ${baseUrl}/fr`,
    "",
    "## Pages",
    "",
    `- [Omra](${baseUrl}/omra)`,
    `- [Hajj](${baseUrl}/hajj)`,
    `- [Voyages organisés](${baseUrl}/voyages-organises)`,
    `- [À propos](${baseUrl}/a-propos)`,
    `- [Questions fréquentes](${baseUrl}/faq)`,
    ...(guides.length > 0 ? [`- [Guides pratiques](${baseUrl}${GUIDE_HUB_PATH})`] : []),
    ...(glossary.locales.length > 0
      ? [`- [Lexique de la Omra, du Hajj et du voyage](${baseUrl}${localizePath(GLOSSARY_PATH, glossary.locales[0])})`]
      : []),
    `- [Contact](${baseUrl}/contact)`,
    `- [Flux RSS des actualités](${baseUrl}/feed.xml)`,
    `- [API JSON publique des programmes](${baseUrl}/api/public/programs)`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
