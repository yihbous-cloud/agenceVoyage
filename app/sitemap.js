import { getProgramsByFamily, getDepartureCities } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";
import { citySlug } from "@/lib/airports";
import { getCurrentAgency } from "@/lib/currentAgency";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, localizePath } from "@/lib/i18n/locales";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Une entrée par page ET par langue, chacune déclarant ses alternates
// hreflang (les autres langues + x-default = langue principale, l'arabe).
function localizedEntries(baseUrl, path, extra) {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((l) => [l, `${baseUrl}${localizePath(path || "/", l)}`])
  );
  languages["x-default"] = `${baseUrl}${localizePath(path || "/", DEFAULT_LOCALE)}`;
  return SUPPORTED_LOCALES.map((l) => ({
    url: `${baseUrl}${localizePath(path || "/", l)}`,
    alternates: { languages },
    ...extra,
  }));
}

export default async function sitemap() {
  const { baseUrl } = await getCurrentAgency();

  const staticRoutes = [
    { url: "", priority: 1 },
    { url: "/omra-hajj", priority: 0.9 },
    { url: "/voyages-organises", priority: 0.9 },
    { url: "/a-propos", priority: 0.5 },
    { url: "/actualites", priority: 0.6 },
    { url: "/faq", priority: 0.5 },
    { url: "/contact", priority: 0.5 },
  ].flatMap((r) =>
    localizedEntries(baseUrl, r.url, { changeFrequency: "weekly", priority: r.priority })
  );

  const [omraHajjPrograms, voyagePrograms, news, departureCities] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    listPublishedNews().catch(() => []),
    getDepartureCities().catch(() => []),
  ]);

  const cityRoutes = departureCities.flatMap((c) =>
    localizedEntries(baseUrl, `/villes-depart/${citySlug(c.city)}`, {
      changeFrequency: "weekly",
      priority: 0.6,
    })
  );

  const programRoutes = [
    ...omraHajjPrograms.flatMap((p) =>
      localizedEntries(baseUrl, `/omra-hajj/${p.slug}`, {
        changeFrequency: "weekly",
        priority: 0.8,
      })
    ),
    ...voyagePrograms.flatMap((p) =>
      localizedEntries(baseUrl, `/voyages-organises/${p.slug}`, {
        changeFrequency: "weekly",
        priority: 0.8,
      })
    ),
  ];

  const newsRoutes = news.flatMap((n) =>
    localizedEntries(baseUrl, `/actualites/${n.slug}`, {
      lastModified: n.published_at,
      changeFrequency: "monthly",
      priority: 0.4,
    })
  );

  return [...staticRoutes, ...programRoutes, ...cityRoutes, ...newsRoutes];
}
