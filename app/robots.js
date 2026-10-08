import { getCurrentAgency } from "@/lib/currentAgency";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Bots IA autorisés explicitement (plutôt que de compter sur la seule règle
// "*") pour signaler clairement que le contenu peut être cité par les
// moteurs génératifs (GEO/AIO) — voir PLAN-SEO-GEO-AIO.md §1.3.
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

// Dynamique par agence (multi-agences) : le sitemap annoncé est celui du
// sous-domaine demandé.
export default async function robots() {
  const { baseUrl } = await getCurrentAgency();

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin"] },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/admin"],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
