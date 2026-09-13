import { getPublishedPrograms } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticRoutes = [
    { url: "", priority: 1 },
    { url: "/programmes", priority: 0.9 },
    { url: "/a-propos", priority: 0.5 },
    { url: "/actualites", priority: 0.6 },
    { url: "/faq", priority: 0.5 },
    { url: "/contact", priority: 0.5 },
  ].map((r) => ({
    url: `${baseUrl}${r.url}`,
    changeFrequency: "weekly",
    priority: r.priority,
  }));

  const [programs, news] = await Promise.all([
    getPublishedPrograms().catch(() => []),
    listPublishedNews().catch(() => []),
  ]);

  const programRoutes = programs.map((p) => ({
    url: `${baseUrl}/programmes/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const newsRoutes = news.map((n) => ({
    url: `${baseUrl}/actualites/${n.slug}`,
    lastModified: n.published_at,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...programRoutes, ...newsRoutes];
}
