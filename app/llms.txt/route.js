import { getPublishedPrograms } from "@/lib/programs";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const programs = await getPublishedPrograms().catch(() => []);

  const lines = [
    "# Golden Fantastic",
    "",
    "> Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
    "",
    "Golden Fantastic organise des voyages Omra et Hajj vers l'Arabie Saoudite ainsi que des séjours touristiques, avec prise en charge complète : vols, hébergement proche des lieux saints, visa et accompagnement pendant le séjour.",
    "",
    "## Programmes",
    "",
    ...programs.map(
      (p) =>
        `- [${p.title}](${baseUrl}/programmes/${p.slug}): ${p.short_description || ""}`
    ),
    "",
    "## Pages",
    "",
    `- [Nos programmes](${baseUrl}/programmes)`,
    `- [À propos](${baseUrl}/a-propos)`,
    `- [Questions fréquentes](${baseUrl}/faq)`,
    `- [Contact](${baseUrl}/contact)`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
