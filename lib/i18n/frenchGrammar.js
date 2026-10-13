// Élision française devant un nom propre (« de Agadir » → « d'Agadir »).
// Fichier PUR (aucune dépendance), utilisable côté client comme serveur.
// Les clés de traduction gardent « de {city} » : une clé à variable seule
// (« Départ {x} ») servirait de motif trop générique au traducteur (CLAUDE.md
// §3quatrevingtdouzequadragies) ; l'élision est donc appliquée au texte
// français déjà assemblé.

const ELIDES = /^[aeiouyàâäéèêëîïôöùûüÿœæh]/i;

export function frenchDe(word) {
  const text = String(word ?? "");
  return ELIDES.test(text) ? `d'${text}` : `de ${text}`;
}

// Remplace « de <mot> » par « d'<mot> » dans un texte, seulement en français
// et seulement si le mot commence par une voyelle ou un h.
export function elideFrenchDe(text, word, locale = "fr") {
  if (locale !== "fr" || !word || !ELIDES.test(word)) return text;
  return String(text).split(`de ${word}`).join(`d'${word}`);
}

// Traducteur (makeTranslator) dont chaque texte, pluriels compris, reçoit
// l'élision devant `word` en français — pour une page construite autour
// d'un nom de ville.
export function withFrenchElision(tr, word, locale) {
  const wrapped = (key, vars) => elideFrenchDe(tr(key, vars), word, locale);
  wrapped.plural = (...args) => elideFrenchDe(tr.plural(...args), word, locale);
  return wrapped;
}
