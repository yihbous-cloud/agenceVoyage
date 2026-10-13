import { NextResponse } from "next/server";
import { getProgramsByFamily } from "@/lib/programs";
import { getCurrentAgency } from "@/lib/currentAgency";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { programPath } from "@/lib/programUrls";
import { stripMarkdown } from "@/lib/markdown";
import { localizePath, INDEXED_LOCALES } from "@/lib/i18n/locales";
import { canonicalLocaleFor, indexedAvailableLocales } from "@/lib/i18n/contentLocale";

// Multi-agences : le contenu dépend du sous-domaine de la requête (en-tête
// posé par proxy.js) — jamais pré-généré au build.
export const dynamic = "force-dynamic";

// API publique en lecture seule (sans authentification) exposant les
// programmes publiés — permet à des agrégateurs/plugins IA de consommer un
// flux structuré plutôt que de dépendre du HTML (PLAN-SEO-GEO-AIO.md §5.2).
async function GET_handler(request) {
  // API publique en lecture : 120 appels / minute par adresse IP (NF-10).
  const limit = await rateLimit(`public-programs:${clientIp(request)}`, { limit: 120, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(NextResponse, 60);
  const { baseUrl } = await getCurrentAgency();
  // ?lang=fr|ar : contenu dans cette langue quand il est traduit (vague 1B) ;
  // sans paramètre, chaque programme dans sa langue principale.
  const requested = new URL(request.url).searchParams.get("lang");
  const lang = INDEXED_LOCALES.includes(requested) ? requested : undefined;
  const [omraHajj, voyages] = await Promise.all([
    getProgramsByFamily("omra_hajj", { locale: lang }).catch(() => []),
    getProgramsByFamily("voyage_organise", { locale: lang }).catch(() => []),
  ]);

  // Texte brut (le Markdown de l'admin n'a pas de sens dans un flux JSON) ;
  // un prix à 0 = palier jamais saisi, exposé comme inconnu (null).
  const toItem = (p) => ({
    title: p.title,
    slug: p.slug,
    family: p.family,
    programType: p.program_type,
    language: p.display_locale,
    availableLanguages: indexedAvailableLocales(p),
    url: `${baseUrl}${localizePath(programPath(p), canonicalLocaleFor(lang || p.content_locale, p))}`,
    shortDescription: stripMarkdown(p.short_description) || null,
    season: p.season || undefined,
    theme: p.theme || undefined,
    nextDepartureDate: p.next_departure_date,
    startingPrice: Number(p.starting_price) > 0 ? p.starting_price : null,
    currency: p.currency,
    seatsRemaining: p.seats_remaining,
    updatedAt: p.updated_at,
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    programs: [...omraHajj.map(toItem), ...voyages.map(toItem)],
  });
}

export const GET = withNotFound(GET_handler);
