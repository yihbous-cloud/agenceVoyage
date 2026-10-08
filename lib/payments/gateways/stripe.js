import crypto from "node:crypto";

// Stripe Checkout (API REST, sans SDK). ⚠️ Écrit d'après la documentation
// Stripe, NON TESTÉ faute de compte : valider avec une clé sk_test_ avant
// toute clé sk_live_ (le mode est déduit du préfixe de la clé, comme Duffel).

export const LABEL = "Stripe (carte bancaire)";
export const SECRET_FIELDS = ["secretKey", "webhookSecret"];
export const PUBLIC_FIELDS = [];

export function modeFromSecrets(secrets) {
  return String(secrets?.secretKey || "").startsWith("sk_live_") ? "live" : "test";
}

// Montant en plus petite unité (centimes) : MAD, EUR, USD ont 2 décimales.
const minor = (amount) => Math.round(Number(amount) * 100);

// STRIPE_API_BASE : faux serveur pour les tests automatisés, ignoré en production.
const apiBase = () => (process.env.NODE_ENV !== "production" && process.env.STRIPE_API_BASE) || "https://api.stripe.com";

export async function createCheckout({ secrets, amount, currency, reference, description, successUrl, cancelUrl }) {
  const form = new URLSearchParams({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: reference,
    "metadata[reference]": reference,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(minor(amount)),
    "line_items[0][price_data][product_data][name]": description.slice(0, 250),
  });
  const res = await fetch(`${apiBase()}/v1/checkout/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secrets.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Stripe : ${data.error?.message || res.status}`), { code: "GATEWAY" });
  return { externalId: data.id, url: data.url };
}

// En-tête Stripe-Signature : "t=1690000000,v1=<hmac>" — HMAC-SHA256 de
// "<t>.<corps brut>" avec le secret du webhook ; tolérance de 5 minutes.
export function verifyWebhook({ rawBody, headers, secrets }) {
  const header = headers.get("stripe-signature") || "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v1 || !secrets?.webhookSecret) return null;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null;
  const expected = crypto.createHmac("sha256", secrets.webhookSecret).update(`${parts.t}.${rawBody}`, "utf8").digest("hex");
  const a = Buffer.from(parts.v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const event = JSON.parse(rawBody);
  if (event.type !== "checkout.session.completed") return { ignored: true };
  const session = event.data?.object || {};
  return {
    reference: session.client_reference_id || session.metadata?.reference,
    externalId: session.id,
    paid: session.payment_status === "paid",
    amount: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || "").toUpperCase(),
    event,
  };
}
