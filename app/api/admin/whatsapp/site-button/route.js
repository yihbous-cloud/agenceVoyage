import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { getWhatsAppButtonSettings, updateWhatsAppButtonSettings } from "@/lib/agencySettings";
import { refreshPublicPages } from "@/lib/publicRevalidation";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Bouton WhatsApp flottant du site public (migration 049).
export const GET = whatsappRoute(["whatsapp.settings"], async () => NextResponse.json(await getWhatsAppButtonSettings()));

export const PUT = whatsappRoute(["whatsapp.settings"], async (request, _context, session) => {
  const body = await readJson(request);
  const { before, after } = await updateWhatsAppButtonSettings(body);
  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: "whatsapp.bouton_site",
    objectType: "agencies",
    objectId: session.agencyId,
    before,
    after,
    ip: requestIp(request),
  });
  // Le bouton est dans le layout : toutes les pages publiques changent.
  await refreshPublicPages({ site: true });
  return NextResponse.json(after);
});
