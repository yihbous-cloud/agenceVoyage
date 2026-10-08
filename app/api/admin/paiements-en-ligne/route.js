import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listGateways, saveGateway, createPaymentLink, listPaymentLinks, cancelPaymentLink } from "@/lib/payments/online";
import { isEncryptionConfigured } from "@/lib/secrets";
import { hasPermission } from "@/lib/permissions";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Paiement en ligne : configuration des passerelles (paiements.passerelles)
// et liens de paiement (paiements.liens).
export const GET = whatsappRoute(["paiements.liens", "paiements.passerelles"], async () =>
  NextResponse.json({ gateways: await listGateways(), links: await listPaymentLinks() })
);

export const POST = whatsappRoute(["paiements.liens", "paiements.passerelles"], async (request, _context, session) => {
  const body = await readJson(request);
  if (body.action === "gateway") {
    if (!(await hasPermission(session, "paiements.passerelles"))) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    if (!isEncryptionConfigured()) return NextResponse.json({ message: "SECRETS_ENCRYPTION_KEY n'est pas configurée sur le serveur." }, { status: 400 });
    const gateways = await saveGateway(body.provider, body.config || {});
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "paiement.passerelle.save", objectType: "payment_gateways", objectId: body.provider, after: { active: Boolean(body.config?.isActive) }, ip: requestIp(request) });
    return NextResponse.json({ gateways });
  }
  if (!(await hasPermission(session, "paiements.liens"))) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  if (body.action === "cancel") {
    await cancelPaymentLink(body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "create") {
    try {
      const link = await createPaymentLink(
        { provider: body.provider, registrationId: Number(body.registrationId), amount: body.amount ? Number(body.amount) : null, conversationId: body.conversationId || null },
        session.id
      );
      return NextResponse.json(link);
    } catch (err) {
      if (err.code === "GATEWAY") return NextResponse.json({ message: err.message }, { status: 502 });
      throw err;
    }
  }
  return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
});
