// Libellés et tons des statuts d'inscription / visa (charte designadmin.md),
// partagés entre la liste des inscrits et la fiche inscription. Fichier pur.
export const REGISTRATION_STATUS = {
  inscrit: { label: "Inscrit", bg: "#e8f0fd", fg: "#2b5cc4" },
  confirme: { label: "Confirmé", bg: "#efe9fb", fg: "#6b3fc4" },
  paye_partiel: { label: "Payé partiel", bg: "#fff4e0", fg: "#a35a00" },
  paye_complet: { label: "Payé complet", bg: "#e6f4ee", fg: "#0f6b4b" },
  annule: { label: "Annulé", bg: "#fdecec", fg: "#c4373b" },
};

export const VISA_STATUS = {
  non_demande: { label: "Non demandé", icon: "schedule", color: "#a0a0a6", bg: "#f1f1ee", fg: "#5a5a60" },
  en_cours: { label: "En cours", icon: "hourglass_top", color: "#f5a524", bg: "#fff4e0", fg: "#a35a00" },
  accorde: { label: "Accordé", icon: "verified", color: "var(--gf-accent)", bg: "#e6f4ee", fg: "#0f6b4b" },
  refuse: { label: "Refusé", icon: "block", color: "#e5484d", bg: "#fdecec", fg: "#c4373b" },
};

export function formatMoney(value) {
  return Number(value || 0)
    .toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");
}

export function initialsOf(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
