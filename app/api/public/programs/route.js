import { NextResponse } from "next/server";
import { getProgramsByFamily } from "@/lib/programs";

// API publique en lecture seule (sans authentification) exposant les
// programmes publiés — permet à des agrégateurs/plugins IA de consommer un
// flux structuré plutôt que de dépendre du HTML (PLAN-SEO-GEO-AIO.md §5.2).
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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
