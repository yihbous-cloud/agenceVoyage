// Minimisation des données (NF-12) : numéros de passeport et de CIN masqués
// dans tout ce qui est journalisé (ia_logs) et dans le contexte CRM envoyé à
// Claude. Heuristique volontairement large : mieux vaut masquer un code de
// réservation par erreur que laisser passer un numéro de passeport.

// Passeport marocain : 2 lettres + 7 chiffres ; formats étrangers : 6-9
// caractères alphanumériques contenant au moins 5 chiffres. CIN marocaine :
// 1-2 lettres + 4-7 chiffres.
const PASSPORT_RE = /\b[A-Z]{1,2}\d{6,8}\b/gi;
const CIN_RE = /\b[A-Z]{1,2}\d{4,7}\b/gi;

export function maskIdentifier(value) {
  const s = String(value || "");
  if (s.length <= 3) return "***";
  return `${"*".repeat(s.length - 3)}${s.slice(-3)}`;
}

export function redactText(text) {
  if (text == null) return text;
  return String(text).replace(PASSPORT_RE, (m) => maskIdentifier(m)).replace(CIN_RE, (m) => maskIdentifier(m));
}

// Copie profonde d'une valeur JSON avec tous les textes masqués.
export function redactDeep(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
}
