import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { getContactDetail, updateContactById } from "@/lib/whatsapp/contacts";
import { exportContactData, deleteContactData } from "@/lib/whatsapp/privacy";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Fiche contact (§8.5) ; ?format=export : données complètes du contact
// (droit d'accès, whatsapp.data) ; DELETE : effacement (whatsapp.data).
export const GET = whatsappRoute(["whatsapp.contacts", "whatsapp.data"], async (request, { params }, session) => {
  const { id } = await params;
  if (request.nextUrl.searchParams.get("format") === "export") {
    if (!(await hasPermission(session, "whatsapp.data"))) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    const data = await exportContactData(Number(id));
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "contact.export_donnees", objectType: "wa_contacts", objectId: id, ip: requestIp(request) });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="contact-${id}-donnees.json"` },
    });
  }
  return NextResponse.json(await getContactDetail(Number(id)));
});

export const PUT = whatsappRoute("whatsapp.contacts", async (request, { params }, session) => {
  const { id } = await params;
  const body = await readJson(request);
  const before = await updateContactById(Number(id), body, session);
  await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "contact.modification", objectType: "wa_contacts", objectId: id, before, after: body, ip: requestIp(request) });
  return NextResponse.json(await getContactDetail(Number(id)));
});

export const DELETE = whatsappRoute("whatsapp.data", async (request, { params }, session) => {
  const { id } = await params;
  const result = await deleteContactData(Number(id));
  await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "contact.suppression_donnees", objectType: "wa_contacts", objectId: id, after: result, ip: requestIp(request) });
  return NextResponse.json({ ok: true, ...result });
});
