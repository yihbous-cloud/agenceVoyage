import { INDEXED_LOCALES, DEFAULT_LOCALE } from "./locales";

// Langue d'un contenu saisi en base (programme, actualité...).
//
// Depuis la vague 1B du référencement (CLAUDE.md §3centquinzequadragies), la
// langue est EXPLICITE : colonne content_locale + tables de traduction
// (lib/contentTranslations.js, qui ajoute `available_locales` aux lignes
// lues pour le site public). detectContentLocale ne sert plus qu'au
// remplissage initial de content_locale (scripts/backfill-content-locale.mjs).
// Fichier pur.

// Sous ce nombre de lettres, le contenu est jugé trop court pour décider.
const MIN_LETTERS = 80;

// "ar" | "fr" | null (indéterminé) — lettres arabes vs latines.
export function detectContentLocale(...texts) {
  const text = texts.filter(Boolean).join(" ");
  const arabic = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿ]/g) || []).length;
  const latin = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (arabic + latin < MIN_LETTERS) return null;
  return arabic >= latin ? "ar" : "fr";
}

// Langues indexées réellement disponibles pour un contenu (ligne passée par
// applyTranslations), langue principale en tête.
export function indexedAvailableLocales(row) {
  const available = row?.available_locales || [row?.content_locale || DEFAULT_LOCALE];
  return available.filter((locale) => INDEXED_LOCALES.includes(locale));
}

// Langue de l'URL canonique d'une page de contenu affichée dans `locale` :
// la page elle-même si son contenu existe dans cette langue, sinon la langue
// principale du contenu (les deux versions afficheraient le même texte).
export function canonicalLocaleFor(locale, row) {
  const available = indexedAvailableLocales(row);
  if (available.includes(locale)) return locale;
  return available[0] || DEFAULT_LOCALE;
}
