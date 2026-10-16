// Organisateur d'un programme (migration 050) — information INTERNE : elle
// n'est jamais affichée ni mentionnée côté client (site public, JSON-LD,
// llms.txt, API publique, agent WhatsApp). Fichier pur, importable côté
// client.
//
// Les libellés sont donnés par langue ici (et NON via le dictionnaire admin) :
// le traducteur remplace « Golden Fantastic » par le nom de l'agence courante
// (brandName), ce qui fausserait « Groupe Golden Fantastic » — un nom de
// groupe fixe, pas la marque de l'agence. Les éléments qui les affichent
// portent translate="no".
export const ORGANIZERS = [
  {
    value: "agence_ouled_teima",
    label: "Agence Ouled Teima",
    labels: { fr: "Agence Ouled Teima", ar: "وكالة أولاد تايمة", en: "Ouled Teima Agency" },
    tone: "#2b5cc4",
    soft: "#e8f0fd",
  },
  {
    value: "groupe_golden_fantastic",
    label: "Groupe Golden Fantastic",
    labels: { fr: "Groupe Golden Fantastic", ar: "مجموعة Golden Fantastic", en: "Golden Fantastic Group" },
    tone: "#a35a00",
    soft: "#fff4e0",
  },
  {
    value: "groupement",
    label: "Groupement",
    labels: { fr: "Groupement", ar: "تشاركي", en: "Partnership" },
    tone: "#0f6b4b",
    soft: "#e6f4ee",
  },
];

export const ORGANIZER_VALUES = ORGANIZERS.map((o) => o.value);

export function getOrganizer(value) {
  return ORGANIZERS.find((o) => o.value === value) || null;
}

// Libellé dans la langue de l'espace interne (repli : français).
export function organizerLabel(value, locale) {
  const o = getOrganizer(value);
  return o ? o.labels[locale] || o.label : "";
}

// Valeur inconnue ou vide -> null (programme sans organisateur choisi).
export function normalizeOrganizer(value) {
  return ORGANIZER_VALUES.includes(value) ? value : null;
}
