// Règles de vérification du passeport (§3nonies) — partagées entre les
// formulaires client (EditTravelerForm, NewRegistrationForm) et les routes
// API qui les persistent, pour que la même règle soit appliquée des deux
// côtés (la validation client seule ne suffit pas, un appel API direct
// doit aussi être bloqué).

// Format générique observé sur la plupart des passeports : lettres et
// chiffres, 6 à 9 caractères. Vérification de forme uniquement — aucune
// consultation d'un registre officiel.
export const PASSPORT_FORMAT = /^[A-Za-z0-9]{6,9}$/;

// Le passeport doit rester valide au moins 6 mois après la date de départ
// du voyage (referenceDate) — pas la date du jour, c'est la règle réelle
// appliquée par les autorités/compagnies aériennes.
export function getMinPassportValidUntil(referenceDate) {
  const reference = referenceDate ? new Date(referenceDate) : new Date();
  const minValidUntil = new Date(reference);
  minValidUntil.setMonth(minValidUntil.getMonth() + 6);
  return { reference, minValidUntil };
}

export function isPassportExpiryValid(expiryDate, referenceDate) {
  if (!expiryDate) return true;
  const { minValidUntil } = getMinPassportValidUntil(referenceDate);
  return new Date(expiryDate) >= minValidUntil;
}
