import { getCurrentAgency } from "@/lib/currentAgency";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Robots des moteurs de recherche et des assistants IA autorisés
// explicitement (cahier des charges référencement §9.2 : tout autoriser, y
// compris l'entraînement, pour que la marque soit connue des modèles). Liste à
// revoir tous les 6 mois — les éditeurs en ajoutent régulièrement.
const CRAWLERS = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "MistralAI-User",
  "CCBot",
];

// Espace interne et API fermés aux robots, sauf l'API publique en lecture
// seule (/api/public, citée dans llms.txt).
const ALLOW = ["/", "/api/public/"];
const DISALLOW = ["/admin", "/api/"];

// Dynamique par agence (multi-agences) : le sitemap annoncé est celui du
// sous-domaine demandé.
export default async function robots() {
  const { baseUrl } = await getCurrentAgency();

  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      { userAgent: CRAWLERS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
