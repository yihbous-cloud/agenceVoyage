import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { logAudit, requestIp } from "@/lib/audit";
import {
  listCampaigns,
  getCampaign,
  saveCampaign,
  deleteCampaign,
  submitCampaign,
  approveCampaign,
  rejectCampaign,
  stopCampaign,
  estimateCampaign,
  previewSegment,
  listSegments,
  saveSegment,
  deleteSegment,
} from "@/lib/whatsapp/campaigns";

export const dynamic = "force-dynamic";

const ANY = ["whatsapp.campaigns", "whatsapp.campaigns.approve"];
const forbidden = () => NextResponse.json({ message: "Non autorisé" }, { status: 403 });

// Campagnes (§8.6, CP-01→06). Préparer = whatsapp.campaigns ; valider,
// refuser = whatsapp.campaigns.approve (responsable) ; arrêt d'urgence =
// l'un ou l'autre.
export const GET = whatsappRoute(ANY, async () =>
  NextResponse.json({ campaigns: await listCampaigns(), segments: await listSegments() })
);

export const POST = whatsappRoute(ANY, async (request, _context, session) => {
  const body = await readJson(request);
  const canPrepare = await hasPermission(session, "whatsapp.campaigns");
  const canApprove = await hasPermission(session, "whatsapp.campaigns.approve");
  const audit = (action, objectId, after = null) =>
    logAudit({ agencyId: session.agencyId, staffId: session.id, action: `campagne.${action}`, objectType: "wa_campaigns", objectId, after, ip: requestIp(request) });

  switch (body.action) {
    case "preview":
      return NextResponse.json(await previewSegment(body.filters || {}));
    case "estimate":
      return NextResponse.json(await estimateCampaign({ filters: body.filters || {}, template_name: body.template_name }));
    case "save_segment":
      if (!canPrepare) return forbidden();
      await saveSegment(body.segment || {}, session.id);
      return NextResponse.json({ segments: await listSegments() });
    case "delete_segment":
      if (!canPrepare) return forbidden();
      await deleteSegment(body.id);
      return NextResponse.json({ segments: await listSegments() });
    case "save": {
      if (!canPrepare) return forbidden();
      const id = await saveCampaign(body.campaign || {}, session.id);
      await audit(body.campaign?.id ? "modification" : "creation", id, { name: body.campaign?.name });
      return NextResponse.json({ id, campaign: await getCampaign(id) });
    }
    case "delete":
      if (!canPrepare) return forbidden();
      await deleteCampaign(body.id);
      await audit("suppression", body.id);
      return NextResponse.json({ ok: true });
    case "submit":
      if (!canPrepare) return forbidden();
      await submitCampaign(body.id);
      await audit("soumission", body.id);
      break;
    case "approve":
      if (!canApprove) return forbidden();
      await approveCampaign(body.id, session.id);
      await audit("validation", body.id);
      break;
    case "reject":
      if (!canApprove) return forbidden();
      await rejectCampaign(body.id, body.note);
      await audit("refus", body.id, { note: body.note || null });
      break;
    case "stop":
      await stopCampaign(body.id, session.id);
      await audit("arret_urgence", body.id);
      break;
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
  return NextResponse.json({ campaign: await getCampaign(body.id) });
});
