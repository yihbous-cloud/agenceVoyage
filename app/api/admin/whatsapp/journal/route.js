import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAuditLog, listIaLogs, listAudits, getAudit, createWeeklyAudit, reviewAuditItem } from "@/lib/whatsapp/journal";
import { toCsv } from "@/lib/whatsapp/contacts";

export const dynamic = "force-dynamic";

function csvResponse(filename, headers, rows) {
  return new NextResponse(toCsv(headers, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}

const json = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

// Journal d'audit, logs IA, audit qualité hebdomadaire (§8.16).
// ?type=audit|ia|audits|audit_detail ; &format=csv pour l'export.
export const GET = whatsappRoute("audit.view", async (request) => {
  const p = request.nextUrl.searchParams;
  const filters = Object.fromEntries(["from", "to", "staff", "action", "outcome", "context", "evaluation", "conversation"].map((k) => [k, p.get(k) || undefined]));
  const csv = p.get("format") === "csv";
  const type = p.get("type") || "audit";
  const paging = { limit: csv ? 5000 : p.get("limit") || 100, offset: p.get("offset") || 0 };
  if (type === "audit") {
    const data = await listAuditLog(filters, paging);
    if (!csv) return NextResponse.json(data);
    return csvResponse(
      "journal-audit.csv",
      [
        { label: "Date (UTC)", key: "created_at" },
        { label: "Utilisateur", key: "staff_name" },
        { label: "Action", key: "action" },
        { label: "Objet", value: (r) => `${r.object_type}${r.object_id ? ` #${r.object_id}` : ""}` },
        { label: "Avant", value: (r) => json(r.before_json) },
        { label: "Après", value: (r) => json(r.after_json) },
        { label: "IP", key: "ip" },
      ],
      data.rows
    );
  }
  if (type === "ia") {
    const data = await listIaLogs(filters, paging);
    if (!csv) return NextResponse.json(data);
    return csvResponse(
      "logs-ia.csv",
      [
        { label: "Date (UTC)", key: "created_at" },
        { label: "Conversation", key: "conversation_id" },
        { label: "Contexte", key: "context" },
        { label: "Modèle", key: "model" },
        { label: "Jetons entrée", key: "input_tokens" },
        { label: "Jetons sortie", key: "output_tokens" },
        { label: "Jetons cache", key: "cache_read_tokens" },
        { label: "Outils", value: (r) => (Array.isArray(r.tools) ? r.tools.map((t) => t.name).join(", ") : "") },
        { label: "Durée (ms)", key: "duration_ms" },
        { label: "Coût (USD)", key: "cost_usd" },
        { label: "Issue", key: "outcome" },
        { label: "Réponse", key: "response" },
      ],
      data.rows
    );
  }
  if (type === "audits") return NextResponse.json(await listAudits());
  if (type === "audit_detail") return NextResponse.json(await getAudit(Number(p.get("id"))));
  return NextResponse.json({ message: "Type inconnu" }, { status: 400 });
});

export const POST = whatsappRoute("audit.view", async (request, _context, session) => {
  const body = await readJson(request);
  if (body.action === "create_audit") return NextResponse.json({ id: await createWeeklyAudit(session.id) });
  if (body.action === "review") {
    await reviewAuditItem(body.itemId, body.review || {}, session.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
});
