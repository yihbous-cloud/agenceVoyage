// Libellés et tons du service de vente de billets (fichier pur, partagé
// client/serveur) — migration 036.
export const TICKET_STATUS = {
  devis: { label: "Devis", bg: "#f1f1ee", fg: "#5a5a60" },
  reserve: { label: "Réservé", bg: "#fff4e0", fg: "#a35a00" },
  emis: { label: "Émis", bg: "#e6f4ee", fg: "#0f6b4b" },
  annule: { label: "Annulé", bg: "#fdecec", fg: "#c4373b" },
};

export const TRIP_TYPE_LABELS = { aller_simple: "Aller simple", aller_retour: "Aller-retour" };

export const TRAVEL_CLASS_LABELS = {
  economique: "Économique",
  premium: "Premium économique",
  affaires: "Affaires",
  premiere: "Première",
};

export function formatMoney(value) {
  return Number(value || 0)
    .toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ")
    .replace("-", "−");
}

export function fmtDay(d) {
  return d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—";
}
