export const SEASON_LABELS = {
  mawlid: "Mawlid",
  rajab: "Rajab",
  chaabane: "Chaabane",
  ramadan: "Ramadan",
  chawal: "Chawal",
};

export function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export function computeDuration(departure, returnDate) {
  if (!departure || !returnDate) return null;
  const nights = Math.round(
    (new Date(returnDate) - new Date(departure)) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0) return null;
  return { days: nights + 1, nights };
}
