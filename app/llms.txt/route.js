import { getProgramsByFamily, getDepartureCities } from "@/lib/programs";
import { citySlug } from "@/lib/airports";
import { getCurrentAgency } from "@/lib/currentAgency";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

export async function GET() {
  const { baseUrl, name: brand } = await getCurrentAgency();
  const [omraHajjPrograms, voyagePrograms, departureCities] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    getDepartureCities().catch(() => []),
  ]);

  const lines = [
    `# ${brand}`,
    "",
    "> Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
    "",
    `${brand} organise deux catalogues de voyages distincts : des programmes Omra et Hajj vers l'Arabie Saoudite (hôtels proches des lieux saints, visa et accompagnement inclus), et des voyages organisés vers d'autres destinations (plage, culture, aventure, famille, couple).`,
    "",
    "## Omra & Hajj",
    "",
    ...omraHajjPrograms.map(
      (p) =>
        `- [${p.title}](${baseUrl}/omra-hajj/${p.slug}): ${p.short_description || ""}`
    ),
    "",
    "## Voyages organisés",
    "",
    ...voyagePrograms.map(
      (p) =>
        `- [${p.title}](${baseUrl}/voyages-organises/${p.slug}): ${p.short_description || ""}`
    ),
    "",
    "## Villes de départ",
    "",
    ...departureCities.map(
      (c) => `- [Départ de ${c.city}](${baseUrl}/villes-depart/${citySlug(c.city)})`
    ),
    "",
    "## Langues",
    "",
    `- Arabe (langue principale) : ${baseUrl}/`,
    `- Français : ${baseUrl}/fr`,
    `- English : ${baseUrl}/en`,
    "",
    "## Pages",
    "",
    `- [Omra & Hajj](${baseUrl}/omra-hajj)`,
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
