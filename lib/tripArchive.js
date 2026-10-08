// Règle UNIQUE « voyage clôturé / archivé » (fichier pur, aucun import) :
// un voyage est archivé quand il est terminé (statut « termine »), annulé
// (« annule »), ou quand sa date de retour (à défaut, de départ) est passée.
// Aucune écriture en base : l'archivage est dérivé, donc automatique dès le
// lendemain du retour. Un programme est archivé quand TOUS ses voyages le sont.
export function tripArchivedSql(alias = "t") {
  return `(${alias}.status IN ('termine', 'annule') OR COALESCE(${alias}.return_date, ${alias}.departure_date) < CURDATE())`;
}

export function isTripArchived(trip, today = new Date()) {
  if (!trip) return false;
  if (["termine", "annule"].includes(trip.status)) return true;
  const end = String(trip.return_date || trip.departure_date || "").slice(0, 10);
  if (!end) return false;
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return end < t;
}
