import { getProgramsByFamily, getDepartureCities } from "@/lib/programs";
import { citySlug } from "@/lib/airports";
import { getCurrentAgency } from "@/lib/currentAgency";
import { programPath, programPillar } from "@/lib/programUrls";
import { plainSummary } from "@/lib/markdown";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Une ligne Markdown par programme : la description saisie dans l'admin peut
// contenir du Markdown et des sauts de ligne, qui cassaient la liste — elle
// est ramenée à un résumé en texte brut sur une ligne.
function programLine(baseUrl, program) {
  const summary = plainSummary(program.short_description, 200);
  return `- [${program.title}](${baseUrl}${programPath(program)})${summary ? `: ${summary}` : ""}`;
}

export async function GET() {
  const { baseUrl, name: brand } = await getCurrentAgency();
  const [omraHajjPrograms, voyagePrograms, departureCities] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    getDepartureCities().catch(() => []),
  ]);
  const omraPrograms = omraHajjPrograms.filter((p) => programPillar(p) === "omra");
  const hajjPrograms = omraHajjPrograms.filter((p) => programPillar(p) === "hajj");

  const section = (title, programs) =>
    programs.length > 0 ? [`## ${title}`, "", ...programs.map((p) => programLine(baseUrl, p)), ""] : [];

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
    `- [Contact](${baseUrl}/contact)`,
    `- [Flux RSS des actualités](${baseUrl}/feed.xml)`,
    `- [API JSON publique des programmes](${baseUrl}/api/public/programs)`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
