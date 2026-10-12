import { getProgramsByFamily, getDepartureCities } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";
import { citySlug } from "@/lib/airports";
import { getCurrentAgency } from "@/lib/currentAgency";
import { programPath } from "@/lib/programUrls";
import { programContentLocale, newsContentLocale } from "@/lib/i18n/contentLocale";
import {
  INDEXED_LOCALES,
  DEFAULT_LOCALE,
  HREFLANG_TAGS,
  localizePath,
} from "@/lib/i18n/locales";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// Une entrée par page ET par langue INDEXÉE (arabe, français — l'anglais est
// hors index, CLAUDE.md §3centtreizequadragies), chacune déclarant ses
// alternates hreflang (ar-MA, fr-MA + x-default = arabe).
// `contentLocale` : contenu saisi en base dans une seule langue (programme,
// actualité) → une seule URL, celle de sa langue réelle, sans alternates
// (même règle que pageAlternates, lib/i18n/seo.js).
function localizedEntries(baseUrl, path, extra, contentLocale) {
  if (contentLocale && INDEXED_LOCALES.includes(contentLocale)) {
    return [{ url: `${baseUrl}${localizePath(path, contentLocale)}`, ...extra }];
  }
  const languages = Object.fromEntries(
    INDEXED_LOCALES.map((l) => [HREFLANG_TAGS[l], `${baseUrl}${localizePath(path, l)}`])
  );
  languages["x-default"] = `${baseUrl}${localizePath(path, DEFAULT_LOCALE)}`;
  return INDEXED_LOCALES.map((l) => ({
    url: `${baseUrl}${localizePath(path, l)}`,
    alternates: { languages },
    ...extra,
  }));
}

export default async function sitemap() {
  const { baseUrl } = await getCurrentAgency();

  const [omraHajjPrograms, voyagePrograms, news, departureCities] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
    listPublishedNews().catch(() => []),
    getDepartureCities().catch(() => []),
  ]);
  const programs = [...omraHajjPrograms, ...voyagePrograms];

  // Date de dernière modification d'un pilier = celle du programme le plus
  // récemment modifié qu'il contient.
  const latest = (list) =>
    list.reduce((max, p) => (p.updated_at && (!max || p.updated_at > max) ? p.updated_at : max), null);
  const lastModified = (date) => (date ? { lastModified: new Date(date) } : {});

  const staticRoutes = [
    { url: "", priority: 1, date: latest(programs) },
    { url: "/omra", priority: 0.9, date: latest(omraHajjPrograms.filter((p) => p.program_type !== "hajj")) },
    { url: "/hajj", priority: 0.9, date: latest(omraHajjPrograms.filter((p) => p.program_type === "hajj")) },
    { url: "/voyages-organises", priority: 0.9, date: latest(voyagePrograms) },
    { url: "/a-propos", priority: 0.5 },
    { url: "/actualites", priority: 0.6, date: news[0]?.published_at },
    { url: "/faq", priority: 0.5 },
    { url: "/contact", priority: 0.5 },
  ].flatMap((r) =>
    localizedEntries(baseUrl, r.url, {
      changeFrequency: "weekly",
      priority: r.priority,
      ...lastModified(r.date),
    })
  );

  const cityRoutes = departureCities.flatMap((c) =>
    localizedEntries(baseUrl, `/villes-depart/${citySlug(c.city)}`, {
      changeFrequency: "weekly",
      priority: 0.6,
    })
  );

  const programRoutes = programs.flatMap((p) =>
    localizedEntries(
      baseUrl,
      programPath(p),
      { changeFrequency: "weekly", priority: 0.8, ...lastModified(p.updated_at) },
      programContentLocale(p)
    )
  );

  const newsRoutes = news.flatMap((n) =>
    localizedEntries(
      baseUrl,
      `/actualites/${n.slug}`,
      { changeFrequency: "monthly", priority: 0.4, ...lastModified(n.updated_at || n.published_at) },
      newsContentLocale(n)
    )
  );

  return [...staticRoutes, ...programRoutes, ...cityRoutes, ...newsRoutes];
}
