import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { setBusinessHours, updateSlaRule, setTripEscorts, setQuickReplies } from "@/lib/whatsapp/team";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Équipe, horaires, délais (SLA), accompagnateurs, réponses rapides (8.13, 8.15).
export const POST = whatsappRoute("whatsapp.team", async (request, _context, session) => {
  const body = await readJson(request);
  let result = { ok: true };
  switch (body.action) {
    case "hours":
      result = await setBusinessHours(body.hours || [], body.exceptions);
      break;
    case "sla":
      await updateSlaRule(body.id, body.rule || {});
      break;
    case "escorts":
      await setTripEscorts(body.tripId, body.staffIds || []);
      break;
    case "quick-replies":
      result = await setQuickReplies(body.replies || []);
      break;
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: `whatsapp.team.${body.action}`,
    objectType: "whatsapp_team",
    objectId: body.id || body.tripId || null,
    after: { action: body.action },
    ip: requestIp(request),
  });
  return NextResponse.json(result);
});
