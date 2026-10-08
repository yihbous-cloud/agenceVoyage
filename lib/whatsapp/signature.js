import crypto from "node:crypto";

// Vérifie l'en-tête X-Hub-Signature-256 envoyé par Meta : HMAC-SHA256 du
// corps BRUT de la requête (avant tout JSON.parse) avec l'app secret de
// l'application Meta. Comparaison à temps constant.
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const [algo, received] = String(signatureHeader).split("=");
  if (algo !== "sha256" || !received) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signMetaPayload(rawBody, appSecret) {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}
