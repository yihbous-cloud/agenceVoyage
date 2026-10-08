import { listPublishedNews } from "@/lib/news";
import { makeTranslator } from "@/lib/i18n/translate";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getCurrentAgency } from "@/lib/currentAgency";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

// Flux RSS des actualités publiées — facilite la découverte de contenu
// frais par les agrégateurs et crawlers IA (PLAN-SEO-GEO-AIO.md §5.2).
export async function GET() {
  const { baseUrl, name: brand } = await getCurrentAgency();
  const news = await listPublishedNews().catch(() => []);
  // Le flux suit la langue principale (arabe) ; les liens sans préfixe
  // pointent vers les pages arabes.
  const tr = makeTranslator(DEFAULT_LOCALE, "public", { brandName: brand });

  const items = news
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/actualites/${post.slug}</link>
      <guid>${baseUrl}/actualites/${post.slug}</guid>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt || "")}</description>
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(brand)} — ${escapeXml(tr("Actualités"))}</title>
    <link>${baseUrl}/actualites</link>
    <description>${escapeXml(tr("Actualités et nouveaux programmes de Golden Fantastic (Omra, Hajj, voyages organisés)."))}</description>
    <language>${DEFAULT_LOCALE}</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
