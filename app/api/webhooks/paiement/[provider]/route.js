import { NextResponse } from "next/server";
import { findLinkByReference, runtimeForLink, confirmLinkPayment } from "@/lib/payments/online";
import * as stripe from "@/lib/payments/gateways/stripe";
import * as cmi from "@/lib/payments/gateways/cmi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Notifications serveur à serveur des passerelles (proxy.js laisse passer
// /api/webhooks/* sans sous-domaine). L'agence est retrouvée par la
// référence du lien, puis la signature est vérifiée avec LES secrets de
// cette agence ; rien n'est enregistré sans signature valide.
function referenceOf(provider, rawBody) {
  if (provider === "stripe") {
    const event = JSON.parse(rawBody);
    const obj = event.data?.object || {};
    return obj.client_reference_id || obj.metadata?.reference || null;
  }
  if (provider === "cmi") return new URLSearchParams(rawBody).get("oid");
  return null;
}

export async function POST(request, { params }) {
  const { provider } = await params;
  const gateway = { stripe, cmi }[provider];
  if (!gateway) return new NextResponse("Passerelle inconnue", { status: 404 });
  const rawBody = await request.text();
  let reference;
  try {
    reference = referenceOf(provider, rawBody);
  } catch {
    return new NextResponse("Requête invalide", { status: 400 });
  }
  const link = reference ? await findLinkByReference(reference) : null;
  if (!link || link.provider !== provider) {
    return provider === "cmi" ? new NextResponse("FAILURE", { status: 200 }) : NextResponse.json({ received: true });
  }
  const rt = await runtimeForLink(link).catch(() => null);
  const verified = rt ? gateway.verifyWebhook({ rawBody, headers: request.headers, secrets: rt.secrets }) : null;
  if (!verified) return provider === "cmi" ? new NextResponse("FAILURE", { status: 200 }) : new NextResponse("Signature invalide", { status: 400 });
  if (verified.ignored) return NextResponse.json({ received: true });
  if (verified.paid) {
    await confirmLinkPayment(link, { amount: verified.amount, externalId: verified.externalId, event: verified.event });
  }
  // CMI attend « ACTION=POSTAUTH » pour finaliser une pré-autorisation acceptée.
  if (provider === "cmi") return new NextResponse(verified.paid ? "ACTION=POSTAUTH" : "APPROVED", { status: 200 });
  return NextResponse.json({ received: true });
}
