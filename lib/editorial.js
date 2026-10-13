import { slugify } from "./slugify";

// Outil éditorial (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies) : constantes et fonctions PURES partagées par
// l'admin (composants client), les pages publiques et les routes API.
// Aucune dépendance base de données.

export const GUIDE_PILLARS = ["omra", "hajj", "voyages", "general"];

// Libellés source (français), traduits à l'affichage par tr().
export const GUIDE_PILLAR_LABELS = {
  omra: "Omra",
  hajj: "Hajj",
  voyages: "Voyages organisés",
  general: "Conseils pratiques",
};

// Pilier public correspondant (chemin sans préfixe de langue).
export const GUIDE_PILLAR_PATHS = {
  omra: "/omra",
  hajj: "/hajj",
  voyages: "/voyages-organises",
  general: null,
};

export const GUIDE_HUB_PATH = "/guide";
export const GLOSSARY_PATH = "/guide/lexique";
// Slugs réservés : pages fixes sous /guide.
export const RESERVED_GUIDE_SLUGS = ["lexique"];

export const guidePath = (slug) => `${GUIDE_HUB_PATH}/${slug}`;

// Pilier d'un programme (lib/programUrls.js : omra | hajj | voyage) → pilier
// d'un guide.
export const guidePillarOfProgramPillar = (pillar) => (pillar === "voyage" ? "voyages" : pillar);

// Pages du site qui affichent des questions de la banque (ia_knowledge.site_page).
export const SITE_PAGES = ["faq", "omra", "hajj", "voyages"];
export const SITE_PAGE_PATHS = {
  faq: "/faq",
  omra: "/omra",
  hajj: "/hajj",
  voyages: "/voyages-organises",
};
export const SITE_PAGE_LABELS = {
  faq: "Questions fréquentes",
  omra: "Pilier Omra",
  hajj: "Pilier Hajj",
  voyages: "Pilier Voyages organisés",
};

// Le texte contient-il majoritairement des lettres arabes ?
export function hasArabic(text) {
  const value = String(text || "");
  const arabic = (value.match(/[؀-ۿ]/g) || []).length;
  const latin = (value.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return arabic > 0 && arabic >= latin;
}

// Langue de contenu utilisée pour une page : l'anglais (hors index) lit le
// français.
const contentLang = (locale) => (locale === "ar" ? "ar" : "fr");

// Question de la banque dans la langue d'une page, ou null si la question
// ou sa réponse manque dans cette langue (jamais de mélange de langues).
// `question` est historiquement saisie librement : écrite en arabe, elle
// sert de version arabe tant que `question_ar` est vide.
export function knowledgeForLocale(item, locale) {
  if (!item) return null;
  const lang = contentLang(locale);
  const base = String(item.question || "").trim();
  const question =
    lang === "ar"
      ? String(item.question_ar || "").trim() || (hasArabic(base) ? base : "")
      : hasArabic(base)
        ? ""
        : base;
  const answer = String((lang === "ar" ? item.answer_ar : item.answer_fr) || "").trim();
  if (!question || !answer) return null;
  return { question, answer };
}

// « Autres formulations » (variantes, darija comprise) : une par ligne.
export function variantList(variants, max = 3) {
  return String(variants || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

// Chemin interne du site (« En savoir plus ») : commence par un seul « / »,
// sans protocole ni « .. ». null sinon.
export function normalizeInternalPath(value) {
  const path = String(value || "").trim();
  if (!path) return null;
  if (!/^\/(?!\/)[^\s]*$/.test(path) || path.includes("..")) return null;
  return path.slice(0, 500);
}

// Nom, fonction et présentation d'un auteur dans la langue d'une page. Le
// nom retombe sur sa forme saisie ; la fonction et la présentation ne
// s'affichent que dans la langue de la page (jamais de texte d'une autre
// langue au milieu de la page).
export function authorDisplay(author, locale) {
  if (!author) return null;
  const ar = contentLang(locale) === "ar";
  return {
    name: (ar && author.name_ar) || author.name,
    jobTitle: (ar ? author.job_title_ar : author.job_title_fr) || null,
    bio: (ar ? author.bio_ar : author.bio_fr) || null,
  };
}

// Terme du lexique dans la langue d'une page (null s'il n'y existe pas).
export function termForLocale(term, locale) {
  const ar = contentLang(locale) === "ar";
  const name = String((ar ? term.term_ar : term.term_fr) || "").trim();
  const definition = String((ar ? term.definition_ar : term.definition_fr) || "").trim();
  if (!name || !definition) return null;
  return { slug: term.slug, name, definition };
}

// Slug d'un guide ou d'un terme : saisi, sinon dérivé du titre (latin). Un
// titre seulement arabe ne donne pas de slug : il faut le saisir.
export function editorialSlug(value, fallbackText) {
  return slugify(String(value || "").trim() || String(fallbackText || ""));
}
