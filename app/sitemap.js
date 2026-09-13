import { getProgramsByFamily } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticRoutes = [
    { url: "", priority: 1 },
    { url: "/omra-hajj", priority: 0.9 },
    { url: "/voyages-organises", priority: 0.9 },
    { url: "/a-propos", priority: 0.5 },
    { url: "/actualites", priority: 0.6 },
    { url: "/faq", priority: 0.5 },
    { url: "/contact", priority: 0.5 },
  ].map((r) => ({
    url: `${baseUrl}${r.url}`,
    changeFrequency: "weekly",
    priority: r.priority,
  }));

  const [omraHajjPrograms, voyagePrograms, news] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    listPublishedNews().catch(() => []),
  ]);

  const programRoutes = [
    ...omraHajjPrograms.map((p) => ({
      url: `${baseUrl}/omra-hajj/${p.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...voyagePrograms.map((p) => ({
      url: `${baseUrl}/voyages-organises/${p.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
  ];

  const newsRoutes = news.map((n) => ({
    url: `${baseUrl}/actualites/${n.slug}`,
    lastModified: n.published_at,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...programRoutes, ...newsRoutes];
}
