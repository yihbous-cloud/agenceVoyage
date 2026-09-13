import { getProgramsByFamily } from "@/lib/programs";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [omraHajjPrograms, voyagePrograms] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
  ]);

  const lines = [
    "# Golden Fantastic",
    "",
    "> Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
    "",
    "Golden Fantastic organise deux catalogues de voyages distincts : des programmes Omra et Hajj vers l'Arabie Saoudite (hôtels proches des lieux saints, visa et accompagnement inclus), et des voyages organisés vers d'autres destinations (plage, culture, aventure, famille, couple).",
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
    "## Pages",
    "",
    `- [Omra & Hajj](${baseUrl}/omra-hajj)`,
    `- [Voyages organisés](${baseUrl}/voyages-organises)`,
    `- [À propos](${baseUrl}/a-propos)`,
    `- [Questions fréquentes](${baseUrl}/faq)`,
    `- [Contact](${baseUrl}/contact)`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
