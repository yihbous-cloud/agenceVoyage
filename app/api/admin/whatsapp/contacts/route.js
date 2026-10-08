import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listContacts, exportContactsCsv, importContactsCsv } from "@/lib/whatsapp/contacts";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

function filtersOf(params) {
  return Object.fromEntries(["q", "stage", "source", "language", "consent", "blocked", "advisor"].map((k) => [k, params.get(k) || undefined]));
}

// Contacts WhatsApp (§8.5) : liste filtrable ; ?format=csv : export.
export const GET = whatsappRoute("whatsapp.contacts", async (request, _context, session) => {
  const params = request.nextUrl.searchParams;
  if (params.get("format") === "csv") {
    const csv = await exportContactsCsv(filtersOf(params));
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "contacts.export", objectType: "wa_contacts", ip: requestIp(request) });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="contacts-whatsapp.csv"' } });
  }
  return NextResponse.json(await listContacts(filtersOf(params), { limit: params.get("limit") || 50, offset: params.get("offset") || 0 }));
});

// Import CSV : colonne de consentement obligatoire.
export const POST = whatsappRoute("whatsapp.contacts", async (request, _context, session) => {
  const body = await readJson(request);
  const result = await importContactsCsv(body.csv || "", session);
  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: "contacts.import",
    objectType: "wa_contacts",
    after: { created: result.created, updated: result.updated, optedIn: result.optedIn, errors: result.errors.length },
    ip: requestIp(request),
  });
  return NextResponse.json(result);
});
