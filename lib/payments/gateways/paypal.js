// PayPal Checkout (API REST Orders v2, sans SDK). ⚠️ Écrit d'après la
// documentation PayPal, NON TESTÉ faute de compte. Le paiement est
// CONFIRMÉ CÔTÉ SERVEUR par la « capture » de la commande au retour du
// client (aucune confiance accordée au navigateur).
// ⚠️ PayPal n'accepte pas le dirham (MAD) : la passerelle convertit le
// montant dans la devise configurée (EUR ou USD) au taux saisi par l'agence.

export const LABEL = "PayPal";
export const SECRET_FIELDS = ["clientSecret"];
export const PUBLIC_FIELDS = ["clientId", "currency", "rateFromMad"];

export function modeFromSecrets(_secrets, publicConfig) {
  return publicConfig?.live === true ? "live" : "test";
}

// PAYPAL_API_BASE : faux serveur pour les tests automatisés, ignoré en production.
function base(mode) {
  if (process.env.NODE_ENV !== "production" && process.env.PAYPAL_API_BASE) return process.env.PAYPAL_API_BASE;
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function token(publicConfig, secrets, mode) {
  const res = await fetch(`${base(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${publicConfig.clientId}:${secrets.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw Object.assign(new Error(`PayPal : ${data.error_description || res.status}`), { code: "GATEWAY" });
  return data.access_token;
}

export function convertedAmount(amount, currency, publicConfig) {
  if (currency !== "MAD") return { value: Number(amount).toFixed(2), currency };
  const rate = Number(publicConfig?.rateFromMad);
  const target = publicConfig?.currency || "EUR";
  if (!rate) throw Object.assign(new Error("PayPal : taux de conversion MAD → devise non configuré."), { code: "GATEWAY" });
  return { value: (Number(amount) * rate).toFixed(2), currency: target };
}

export async function createCheckout({ secrets, publicConfig, mode, amount, currency, reference, description, successUrl, cancelUrl }) {
  const access = await token(publicConfig, secrets, mode);
  const converted = convertedAmount(amount, currency, publicConfig);
  const res = await fetch(`${base(mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: reference, custom_id: reference, description: description.slice(0, 127), amount: { currency_code: converted.currency, value: converted.value } }],
      application_context: { return_url: successUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`PayPal : ${data.message || res.status}`), { code: "GATEWAY" });
  const approve = (data.links || []).find((l) => l.rel === "approve" || l.rel === "payer-action");
  return { externalId: data.id, url: approve?.href };
}

// Capture au retour du client : COMPLETED = payé.
export async function captureOrder({ secrets, publicConfig, mode, orderId }) {
  const access = await token(publicConfig, secrets, mode);
  const res = await fetch(`${base(mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    paid: res.ok && data.status === "COMPLETED",
    reference: unit?.custom_id || unit?.reference_id || null,
    externalId: orderId,
    amount: Number(capture?.amount?.value || 0),
    currency: capture?.amount?.currency_code || null,
    event: data,
  };
}
