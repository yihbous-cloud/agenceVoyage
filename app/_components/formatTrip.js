// Libellés des saisons du calendrier hégirien : traduits à l'affichage par
// tr() (voir lib/i18n) — les clés ci-dessous sont les textes sources.
export const SEASON_LABELS = {
  mawlid: "Mawlid",
  rajab: "Rajab",
  chaabane: "Chaabane",
  ramadan: "Ramadan",
  chawal: "Chawal",
};

// jj/mm/aaaa quelle que soit la langue (usage marocain), chiffres latins ;
// intlTag ("ar-MA", "fr-FR", "en-GB") ne change que les séparateurs.
export function formatDate(date, intlTag = "fr-FR") {
  return new Date(date).toLocaleDateString(intlTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function computeDuration(departure, returnDate) {
  if (!departure || !returnDate) return null;
  const nights = Math.round(
    (new Date(returnDate) - new Date(departure)) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0) return null;
  return { days: nights + 1, nights };
}
