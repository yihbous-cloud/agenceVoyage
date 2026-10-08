import crypto from "node:crypto";

// CMI (Centre Monétique Interbancaire, Maroc) — « 3D Pay Hosting » : le
// client est envoyé par un FORMULAIRE auto-soumis vers la page de paiement
// CMI ; CMI notifie ensuite le serveur (callbackUrl), notification dont le
// HASH est vérifié. ⚠️ Écrit d'après la documentation d'intégration CMI
// (hash « ver3 »), NON TESTÉ faute de compte marchand : valider sur
// l'environnement de test CMI avant la production.

export const LABEL = "CMI (carte bancaire marocaine)";
export const SECRET_FIELDS = ["storeKey"];
export const PUBLIC_FIELDS = ["clientId", "gatewayUrl"];

export const TEST_GATEWAY_URL = "https://testpayment.cmi.co.ma/fim/est3Dgate";

export function modeFromSecrets(_secrets, publicConfig) {
  return publicConfig?.gatewayUrl && !String(publicConfig.gatewayUrl).includes("test") ? "live" : "test";
}

// Hash ver3 : valeurs triées par nom de champ (insensible à la casse, hors
// "hash" et "encoding"), chaque « \ » et « | » échappé, jointes par « | »,
// suivies de « | » + clé du magasin ; SHA-512 encodé en base64.
export function cmiHash(params, storeKey) {
  const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  const keys = Object.keys(params)
    .filter((k) => !["hash", "encoding"].includes(k.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const plain = `${keys.map((k) => esc(params[k])).join("|")}|${esc(storeKey)}`;
  return crypto.createHash("sha512").update(plain, "utf8").digest("base64");
}

// Champs du formulaire à soumettre vers CMI (rendu par /api/paiement/[ref]).
export function checkoutForm({ secrets, publicConfig, amount, reference, successUrl, cancelUrl, callbackUrl, customer = {} }) {
  const params = {
    clientid: publicConfig.clientId,
    amount: Number(amount).toFixed(2),
    oid: reference,
    okUrl: successUrl,
    failUrl: cancelUrl,
    callbackUrl,
    shopurl: successUrl,
    TranType: "PreAuth",
    currency: "504", // MAD (ISO 4217 numérique)
    rnd: String(Date.now()),
    storetype: "3D_PAY_HOSTING",
    hashAlgorithm: "ver3",
    lang: "fr",
    encoding: "UTF-8",
    BillToName: customer.name || "",
    email: customer.email || "",
    tel: customer.phone || "",
  };
  params.HASH = cmiHash(params, secrets.storeKey);
  return { action: publicConfig.gatewayUrl || TEST_GATEWAY_URL, params };
}

// Notification serveur à serveur (POST form-urlencoded).
export function verifyWebhook({ rawBody, secrets }) {
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const received = params.HASH || params.hash;
  if (!received || !secrets?.storeKey) return null;
  const { HASH, hash, ...rest } = params;
  void HASH;
  void hash;
  const expected = cmiHash(rest, secrets.storeKey);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return {
    reference: params.oid,
    externalId: params.TransId || params.oid,
    paid: params.ProcReturnCode === "00" && /approved/i.test(params.Response || ""),
    amount: Number(params.amount || 0),
    currency: "MAD",
    event: params,
  };
}
