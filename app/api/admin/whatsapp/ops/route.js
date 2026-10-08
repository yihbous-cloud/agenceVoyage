import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { getOpsSettings, saveOpsSettings } from "@/lib/whatsapp/ops";
import { purgeAgencyData } from "@/lib/whatsapp/privacy";
import { deliverDailyReport } from "@/lib/whatsapp/reports";
import { listJobs } from "@/lib/systemJobs";
import { isMailConfigured } from "@/lib/mailer";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Réglages d'exploitation (§8.17) : tarifs Meta, rapport quotidien, alertes
// (whatsapp.settings) ; conservation des données et purge (whatsapp.data) ;
// état des tâches planifiées.
export const GET = whatsappRoute(["whatsapp.settings", "whatsapp.data"], async () =>
  NextResponse.json({ settings: await getOpsSettings(), jobs: await listJobs(), mailConfigured: isMailConfigured() })
);

const RETENTION_KEYS = ["retention_documents_days_after_trip", "retention_media_days", "retention_conversations_months", "retention_ia_logs_days", "purge_enabled"];

export const POST = whatsappRoute(["whatsapp.settings", "whatsapp.data"], async (request, _context, session) => {
  const body = await readJson(request);
  const canSettings = await hasPermission(session, "whatsapp.settings");
  const canData = await hasPermission(session, "whatsapp.data");
  const ip = requestIp(request);
  if (body.action === "save") {
    const data = { ...(body.settings || {}) };
    for (const k of Object.keys(data)) {
      const isRetention = RETENTION_KEYS.includes(k);
      if ((isRetention && !canData) || (!isRetention && !canSettings)) delete data[k];
    }
    const { before, after } = await saveOpsSettings(data);
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "exploitation.reglages", objectType: "wa_ops_settings", before, after, ip });
    return NextResponse.json({ settings: after });
  }
  if (body.action === "purge_preview" || body.action === "purge_now") {
    if (!canData) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    const result = await purgeAgencyData(undefined, { dryRun: body.action === "purge_preview" });
    if (body.action === "purge_now") {
      await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "donnees.purge_manuelle", objectType: "wa_ops_settings", after: result, ip });
    }
    return NextResponse.json(result);
  }
  if (body.action === "report_now") {
    if (!canSettings) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    const result = await deliverDailyReport(undefined, { force: true });
    return NextResponse.json({ text: result.report.text, mail: result.mail });
  }
  return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
});
