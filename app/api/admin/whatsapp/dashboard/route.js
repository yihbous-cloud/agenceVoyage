import { NextResponse } from "next/server";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { inboxScope } from "@/lib/whatsapp/conversations";
import { dashboardData } from "@/lib/whatsapp/analytics";

export const dynamic = "force-dynamic";

// Tableau de bord WhatsApp (§8.1). Périmètre « équipe » pour qui n'a pas
// accès à toutes les conversations (matrice du cahier §3).
export const GET = whatsappRoute("whatsapp.dashboard", async (request, _context, session) => {
  const params = request.nextUrl.searchParams;
  const scope = (await inboxScope(session)) === "all" ? "all" : "own";
  return NextResponse.json(await dashboardData({ scope, session, period: { from: params.get("from"), to: params.get("to") } }));
});
