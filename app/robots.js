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

export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
