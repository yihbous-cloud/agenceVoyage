// Libellés et tons partagés des écrans WhatsApp (fichier pur, client/serveur).

export const CONVERSATION_STATUS = {
  ia: { label: "IA active", bg: "#e6f4ee", fg: "#0f6b4b" },
  copilote: { label: "Copilote", bg: "#efe9fb", fg: "#6b3fc4" },
  humain: { label: "Humain", bg: "#e8f0fd", fg: "#2b5cc4" },
  attente: { label: "En attente client", bg: "#fff4e0", fg: "#a35a00" },
  resolu: { label: "Résolu", bg: "#f1f1ee", fg: "#5a5a60" },
};

export const PRIORITY = {
  urgente: { label: "Urgente", bg: "#fdecec", fg: "#c4373b" },
  haute: { label: "Haute", bg: "#fff4e0", fg: "#a35a00" },
  normale: { label: "Normale", bg: "#f1f1ee", fg: "#5a5a60" },
  basse: { label: "Basse", bg: "#f1f1ee", fg: "#8a8a90" },
};

export const REASONS = {
  intention_achat: "Intention d'achat",
  negociation: "Négociation / groupe",
  reclamation: "Réclamation",
  cas_particulier: "Cas particulier",
  demande_humain: "Demande d'un conseiller",
  question_religieuse: "Question religieuse",
  echec_ia: "L'IA n'a pas pu répondre",
  urgence: "Urgence en voyage",
  recu_paiement: "Reçu de paiement",
  vocal_non_transcrit: "Vocal non transcrit",
  conseiller_attitre: "Conseiller attitré",
  prise_en_main: "Prise en main",
};

export const TEAMS = {
  ventes: "Ventes",
  comptabilite: "Comptabilité",
  suivi: "Dossiers",
  direction: "Responsable",
  guide: "Guide religieux",
  accompagnateur: "Accompagnateur",
  marketing: "Marketing",
};

export const SEND_STATUS = {
  en_attente: "En attente",
  envoye: "Envoyé",
  livre: "Livré",
  lu: "Lu",
  echec: "Échec",
};

export const STAGES = {
  prospect: "Prospect",
  qualifie: "Qualifié",
  inscrit: "Inscrit",
  en_voyage: "En voyage",
  ancien: "Ancien pèlerin",
  perdu: "Perdu",
};

// Dates stockées en UTC (MySQL), affichées à l'heure du Maroc.
export function formatDateTime(value, opts = {}) {
  if (!value) return "—";
  const d = new Date(`${String(value).replace(" ", "T")}${String(value).endsWith("Z") ? "" : "Z"}`);
  return d.toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}
