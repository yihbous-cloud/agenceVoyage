import { NextResponse } from "next/server";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { statisticsData } from "@/lib/whatsapp/analytics";

export const dynamic = "force-dynamic";

// Statistiques détaillées (§8.2) : entonnoirs, motifs, templates, campagnes.
export const GET = whatsappRoute(["whatsapp.costs", "whatsapp.campaigns", "whatsapp.conversations.all"], async (request) => {
  const params = request.nextUrl.searchParams;
  return NextResponse.json(await statisticsData({ from: params.get("from"), to: params.get("to") }));
});
