import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { getActiveSettings, listSettingsVersions, saveSettingsVersion, activateSettingsVersion, getSettingsVersion } from "@/lib/ai/settings";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Réglages de l'agent IA (exigence 8.8) — réservé à ia.settings (direction
// par défaut). Chaque enregistrement crée une version (traçabilité + retour
// arrière en un clic) et est inscrit au journal d'audit.
export const GET = whatsappRoute("ia.settings", async (request) => {
  const versionId = request.nextUrl.searchParams.get("version");
  const settings = versionId ? await getSettingsVersion(versionId) : await getActiveSettings();
  return NextResponse.json({ settings, versions: await listSettingsVersions() });
});

export const POST = whatsappRoute("ia.settings", async (request, _context, session) => {
  const body = await readJson(request);
  const before = await getActiveSettings();
  let after;
  if (body.action === "activate") {
    after = await activateSettingsVersion(body.id);
  } else {
    after = await saveSettingsVersion(body.settings || {}, session.id);
  }
  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: body.action === "activate" ? "ia.settings.activate" : "ia.settings.save",
    objectType: "ia_settings",
    objectId: after.id,
    before: { version: before.version, mode: before.mode, model: before.model_conversation },
    after: { version: after.version, mode: after.mode, model: after.model_conversation, note: after.note },
    ip: requestIp(request),
  });
  return NextResponse.json({ settings: after, versions: await listSettingsVersions() });
});
