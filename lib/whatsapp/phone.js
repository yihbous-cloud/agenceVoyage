// Numéros WhatsApp. Meta identifie un contact par son "wa_id" : indicatif
// pays + numéro, chiffres uniquement, sans "+" (ex. 212662681625). Le CRM,
// lui, stocke les numéros tels que saisis par le personnel (souvent au format
// marocain local "0662681625") — d'où les variantes de recherche ci-dessous.

export function normalizeWaId(raw) {
  return String(raw || "").replace(/\D/g, "").replace(/^00/, "");
}

// Formes sous lesquelles un même numéro a pu être saisi dans travelers.phone_whatsapp.
export function phoneLookupVariants(waId) {
  const digits = normalizeWaId(waId);
  if (!digits) return [];
  const variants = new Set([digits, `+${digits}`, `00${digits}`]);
  if (digits.startsWith("212") && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    variants.add(local);
    variants.add(`${local.slice(0, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8)}`);
    variants.add(`+212 ${digits.slice(3)}`);
  }
  return [...variants];
}

// Inverse : numéro saisi dans le CRM → wa_id (pour écrire à un voyageur).
export function toWaId(raw, defaultCountry = "212") {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("+")) return normalizeWaId(s);
  const digits = s.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) return `${defaultCountry}${digits.slice(1)}`;
  return digits;
}
