import { listPublishedNews } from "@/lib/news";

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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const news = await listPublishedNews().catch(() => []);

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
    <title>Golden Fantastic — Actualités</title>
    <link>${baseUrl}/actualites</link>
    <description>Actualités et nouveaux programmes de Golden Fantastic (Omra, Hajj, voyages organisés).</description>
    <language>fr</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
