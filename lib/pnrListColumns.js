// Colonnes et formats d'affichage de la liste "compagnie aérienne avec PNR".
// Fichier pur (aucun import) : partagé entre l'interface de choix (composant
// client, qui en tire les exemples affichés dans les listes déroulantes) et
// la route d'export (serveur, qui applique réellement les formats) — une
// seule source de vérité, l'exemple montré à l'écran est exactement ce que
// produira le fichier.

const pad = (n) => String(n).padStart(2, "0");

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_FR_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const upper3 = (s) => s.slice(0, 3).toUpperCase();
const cap3 = (s) => s.slice(0, 3);

// Entrée attendue : "AAAA-MM-JJ" (les DATE MySQL sont renvoyées en chaînes,
// voir lib/db.js `dateStrings`). Une valeur illisible retombe sur le texte brut.
function parseIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
}

const dateFormat = (key, label, fn) => ({
  key,
  fn: (value) => {
    const p = parseIso(value);
    return p ? fn(p) : String(value ?? "");
  },
  label,
});

export const DATE_FORMATS = [
  dateFormat("dd_mm_yyyy", "jj/mm/aaaa", ({ y, mo, d }) => `${pad(d)}/${pad(mo)}/${y}`),
  dateFormat("dd_mm_yyyy_dash", "jj-mm-aaaa", ({ y, mo, d }) => `${pad(d)}-${pad(mo)}-${y}`),
  dateFormat("dd_mm_yyyy_dot", "jj.mm.aaaa", ({ y, mo, d }) => `${pad(d)}.${pad(mo)}.${y}`),
  dateFormat("dd_mm_yy", "jj/mm/aa", ({ y, mo, d }) => `${pad(d)}/${pad(mo)}/${String(y).slice(2)}`),
  dateFormat("mm_dd_yyyy", "mm/jj/aaaa (US)", ({ y, mo, d }) => `${pad(mo)}/${pad(d)}/${y}`),
  dateFormat("yyyy_mm_dd", "aaaa-mm-jj (ISO)", ({ y, mo, d }) => `${y}-${pad(mo)}-${pad(d)}`),
  dateFormat("yyyy_mm_dd_slash", "aaaa/mm/jj", ({ y, mo, d }) => `${y}/${pad(mo)}/${pad(d)}`),
  dateFormat("yyyymmdd", "aaaammjj", ({ y, mo, d }) => `${y}${pad(mo)}${pad(d)}`),
  dateFormat("ddmmyyyy", "jjmmaaaa", ({ y, mo, d }) => `${pad(d)}${pad(mo)}${y}`),
  dateFormat("dd_MON_yyyy", "jj MOIS aaaa (EN)", ({ y, mo, d }) => `${pad(d)} ${upper3(MONTHS_EN[mo - 1])} ${y}`),
  dateFormat("dd_Mon_yyyy", "jj Mois aaaa (EN)", ({ y, mo, d }) => `${pad(d)} ${cap3(MONTHS_EN[mo - 1])} ${y}`),
  dateFormat("dd_MON_dash_yyyy", "jj-MOIS-aaaa (EN)", ({ y, mo, d }) => `${pad(d)}-${upper3(MONTHS_EN[mo - 1])}-${y}`),
  dateFormat("ddMONyyyy", "jjMOISaaaa (EN)", ({ y, mo, d }) => `${pad(d)}${upper3(MONTHS_EN[mo - 1])}${y}`),
  dateFormat("ddMONyy", "jjMOISaa (EN)", ({ y, mo, d }) => `${pad(d)}${upper3(MONTHS_EN[mo - 1])}${String(y).slice(2)}`),
  dateFormat("dd_MONTH_yyyy_en", "jj MOIS COMPLET aaaa (EN)", ({ y, mo, d }) => `${pad(d)} ${MONTHS_EN[mo - 1].toUpperCase()} ${y}`),
  dateFormat("dd_Month_yyyy_en", "jj Mois complet aaaa (EN)", ({ y, mo, d }) => `${pad(d)} ${MONTHS_EN[mo - 1]} ${y}`),
  dateFormat("Month_dd_yyyy_en", "Mois jj, aaaa (EN)", ({ y, mo, d }) => `${MONTHS_EN[mo - 1]} ${pad(d)}, ${y}`),
  dateFormat("dd_mois_yyyy_fr", "jj mois aaaa (FR)", ({ y, mo, d }) => `${pad(d)} ${MONTHS_FR[mo - 1]} ${y}`),
  dateFormat("d_mois_yyyy_fr", "j mois aaaa (FR)", ({ y, mo, d }) => `${d} ${MONTHS_FR[mo - 1]} ${y}`),
  dateFormat("dd_MOIS_yyyy_fr", "jj MOIS aaaa (FR)", ({ y, mo, d }) => `${pad(d)} ${MONTHS_FR[mo - 1].toUpperCase()} ${y}`),
  dateFormat("dd_mois_court_yyyy_fr", "jj mois abrégé aaaa (FR)", ({ y, mo, d }) => `${pad(d)} ${MONTHS_FR_SHORT[mo - 1]} ${y}`),
];

const genderFormat = (key, male, female) => ({
  key,
  fn: (value) => (value === "femme" || value === "Femme" ? female : male),
  label: `${male} / ${female}`,
});

export const GENDER_FORMATS = [
  genderFormat("fr_full", "Homme", "Femme"),
  genderFormat("fr_full_caps", "HOMME", "FEMME"),
  genderFormat("fr_short", "H", "F"),
  genderFormat("fr_masc_fem", "Masculin", "Féminin"),
  genderFormat("en_full", "Male", "Female"),
  genderFormat("en_full_caps", "MALE", "FEMALE"),
  genderFormat("en_short", "M", "F"),
  genderFormat("title_mr_mrs", "MR", "MRS"),
  genderFormat("title_mr_ms", "MR", "MS"),
];

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s'\-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

const textFormat = (key, label, fn) => ({ key, label, fn: (v) => fn(String(v ?? "")) });

export const NAME_FORMATS = [
  textFormat("as_is", "Tel que saisi", (v) => v),
  textFormat("upper", "MAJUSCULES", (v) => v.toUpperCase()),
  textFormat("upper_ascii", "MAJUSCULES sans accents", (v) => stripAccents(v).toUpperCase()),
  textFormat("title", "Première Lettre Majuscule", titleCase),
  textFormat("lower", "minuscules", (v) => v.toLowerCase()),
];

export const PASSPORT_FORMATS = [
  textFormat("as_is", "Tel que saisi", (v) => v),
  textFormat("upper", "MAJUSCULES", (v) => v.toUpperCase()),
  textFormat("compact", "MAJUSCULES sans espaces ni tirets", (v) =>
    v.toUpperCase().replace(/[\s\-.]/g, "")
  ),
];

function toInternational(value, prefix) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return prefix === "+" ? `+${digits}` : `00${digits}`;
  if (digits.startsWith("00")) {
    const rest = digits.slice(2);
    return prefix === "+" ? `+${rest}` : `00${rest}`;
  }
  // Numéro marocain local (0X XX XX XX XX) → indicatif +212
  if (digits.startsWith("0") && digits.length === 10) {
    const rest = `212${digits.slice(1)}`;
    return prefix === "+" ? `+${rest}` : `00${rest}`;
  }
  return digits;
}

export const PHONE_FORMATS = [
  textFormat("as_is", "Tel que saisi", (v) => v),
  textFormat("digits", "Chiffres uniquement", (v) => v.replace(/\D/g, "")),
  textFormat("intl_plus", "International +212...", (v) => toInternational(v, "+")),
  textFormat("intl_00", "International 00212...", (v) => toInternational(v, "00")),
];

export const FORMATS_BY_TYPE = {
  date: DATE_FORMATS,
  gender: GENDER_FORMATS,
  name: NAME_FORMATS,
  passport: PASSPORT_FORMATS,
  phone: PHONE_FORMATS,
};

// Valeurs d'exemple utilisées pour afficher, dans chaque liste déroulante,
// le rendu réel de chaque format. Jour (7) ≠ mois (9) pour que jj/mm et
// mm/jj se distinguent à l'écran.
const SAMPLES = {
  date: "2026-09-07",
  name: "Hélène el Amrani",
  passport: "ab-123456",
  phone: "0662681625",
};

// `label` : texte de l'option. Pour les dates/noms/passeports/téléphones on
// montre le résultat sur l'exemple ; pour le genre, la paire "homme / femme".
export function getFormatOptions(column) {
  const list = FORMATS_BY_TYPE[column.type];
  if (!list) return [];
  return list.map((f) => {
    if (column.type === "gender") return { key: f.key, label: f.label };
    const sample = f.fn(SAMPLES[column.type]);
    return { key: f.key, label: sample };
  });
}

export function getDefaultFormatKey(column) {
  const list = FORMATS_BY_TYPE[column.type];
  return list ? list[0].key : null;
}

// Applique le format choisi (clé inconnue → premier format du type).
export function formatPnrValue(column, rawValue, formatKey) {
  const list = FORMATS_BY_TYPE[column.type];
  if (!list) return rawValue == null ? "" : String(rawValue);
  if (rawValue == null || rawValue === "") return "";
  const format = list.find((f) => f.key === formatKey) || list[0];
  return format.fn(rawValue);
}

// `headerEn` : en-tête pour la compagnie qui exige l'anglais.
// `type` : famille de formats disponibles (absent = aucun format à choisir).
// `default` : cochée par défaut.
export const PNR_LIST_COLUMNS = [
  { key: "pnr", header: "N° PNR", headerEn: "PNR", default: true },
  { key: "full_name", header: "Nom complet", headerEn: "Full name", type: "name", default: true },
  { key: "date_of_birth", header: "Date de naissance", headerEn: "Date of birth", type: "date", default: true },
  { key: "passport_number", header: "N° Passeport", headerEn: "Passport No.", type: "passport", default: true },
  { key: "passport_issue_date", header: "Date de délivrance", headerEn: "Date of issue", type: "date", default: true },
  { key: "passport_expiry_date", header: "Date d'expiration", headerEn: "Date of expiry", type: "date", default: true },
  { key: "full_name_arabic", header: "Nom complet (arabe)", headerEn: "Full name (Arabic)", default: false },
  { key: "gender", header: "Genre", headerEn: "Gender", type: "gender", default: false },
  { key: "phone_whatsapp", header: "Téléphone (WhatsApp)", headerEn: "Phone", type: "phone", default: false },
  { key: "departure_date", header: "Date de départ", headerEn: "Departure date", type: "date", default: false },
  { key: "return_date", header: "Date de retour", headerEn: "Return date", type: "date", default: false },
];

export const HEADER_LANGUAGES = [
  { key: "fr", label: "Français" },
  { key: "en", label: "English" },
];

export const PDF_ORIENTATIONS = [
  { key: "auto", label: "Automatique" },
  { key: "portrait", label: "Portrait" },
  { key: "landscape", label: "Paysage" },
];
