import { NextResponse } from "next/server";
import { getProgramsByFamily } from "@/lib/programs";
import { getCurrentAgency } from "@/lib/currentAgency";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

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
  const [omraHajj, voyages] = await Promise.all([
    getProgramsByFamily("omra_hajj").catch(() => []),
    getProgramsByFamily("voyage_organise").catch(() => []),
  ]);

  const toItem = (p) => ({
    title: p.title,
    slug: p.slug,
    family: p.family,
    url: `${baseUrl}/${p.family === "omra_hajj" ? "omra-hajj" : "voyages-organises"}/${p.slug}`,
    shortDescription: p.short_description,
    season: p.season || undefined,
    theme: p.theme || undefined,
    nextDepartureDate: p.next_departure_date,
    startingPrice: p.starting_price,
    currency: p.currency,
    seatsRemaining: p.seats_remaining,
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    programs: [...omraHajj.map(toItem), ...voyages.map(toItem)],
  });
}

export const GET = withNotFound(GET_handler);
