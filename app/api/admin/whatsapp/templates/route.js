import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import {
  listApprovedTemplates,
  listTemplates,
  syncTemplates,
  saveTemplateDraft,
  duplicateTemplate,
  deleteTemplate,
  submitTemplate,
  getTemplate,
  renderTemplate,
  seedDefaultTemplates,
  templateStats,
  validateTemplate,
} from "@/lib/whatsapp/templates";
import { buildCrmContext } from "@/lib/whatsapp/crmContext";
import { logAudit, requestIp } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const INBOX = ["whatsapp.conversations.all", "whatsapp.conversations.own"];

// GET : templates approuvés (inbox) ; ?all=1 : gestion complète (8.11).
export const GET = whatsappRoute([...INBOX, "whatsapp.templates"], async (request, _context, session) => {
  // Liste complète (brouillons, refus, statistiques) : gestion des templates seulement ;
  // l'inbox ne reçoit que les templates approuvés.
  if (request.nextUrl.searchParams.get("all") === "1" && (await hasPermission(session, "whatsapp.templates"))) {
    return NextResponse.json({ templates: await listTemplates(), stats: await templateStats() });
  }
  return NextResponse.json(await listApprovedTemplates());
});

// Fichier d'exemple d'en-tête média, pris parmi les fichiers envoyés (public/uploads).
async function readHeaderSample(publicPath) {
  const clean = String(publicPath || "").replace(/^\/+/, "");
  if (!clean.startsWith("uploads/") || clean.includes("..")) return null;
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "public", clean);
  const buffer = await fs.readFile(/* turbopackIgnore: true */ file);
  const ext = path.extname(file).slice(1).toLowerCase();
  const mimeType = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" }[ext] || "application/octet-stream";
  return { buffer, mimeType, fileName: path.basename(file) };
}

// Actions : sync (whatsapp.settings ou .templates), save, duplicate, delete,
// submit, preview, seed, validate (whatsapp.templates).
export const POST = whatsappRoute(["whatsapp.templates", "whatsapp.settings"], async (request, _context, session) => {
  const body = await readJson(request);
  const audit = (action, objectId, after) =>
    logAudit({ agencyId: session.agencyId, staffId: session.id, action, objectType: "wa_templates", objectId, after, ip: requestIp(request) });
  switch (body.action || "sync") {
    case "sync": {
      const count = await syncTemplates();
      return NextResponse.json({ count, templates: await listApprovedTemplates() });
    }
    case "save": {
      const t = await saveTemplateDraft(body.template || {});
      await audit("whatsapp.template.save", t.id, { name: t.name, language: t.language });
      return NextResponse.json(t);
    }
    case "duplicate": {
      const t = await duplicateTemplate(body.id, { name: body.name, language: body.language });
      await audit("whatsapp.template.duplicate", t.id, { from: body.id });
      return NextResponse.json(t);
    }
    case "delete":
      await deleteTemplate(body.id);
      await audit("whatsapp.template.delete", body.id, null);
      return NextResponse.json({ ok: true });
    case "submit": {
      const sample = body.headerSample ? await readHeaderSample(body.headerSample) : null;
      const t = await submitTemplate(body.id, { headerSample: sample });
      await audit("whatsapp.template.submit", t.id, { name: t.name, language: t.language, status: t.status });
      return NextResponse.json(t);
    }
    case "validate":
      return NextResponse.json(validateTemplate(body.template || {}));
    case "preview": {
      // Aperçu avec les données d'un vrai dossier (TP-06).
      const t = body.id ? await getTemplate(body.id) : null;
      const template = t || { simple: body.template?.simple || {}, variable_mapping: body.template?.mapping || {} };
      const context = await buildCrmContext(session.agencyId, { registrationId: body.registrationId ? Number(body.registrationId) : null });
      return NextResponse.json(renderTemplate(template, context));
    }
    case "seed": {
      const created = await seedDefaultTemplates();
      await audit("whatsapp.template.seed", null, { created });
      return NextResponse.json({ created });
    }
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
});
