import { dict as frDict } from "./fr";
import { dict as enDict } from "./en";
import { dict as arDict } from "./ar";
import { DEFAULT_LOCALE, isValidLocale } from "./locales";

const DICTS = { fr: frDict, en: enDict, ar: arDict };

// Fusionne avec fr pour toute section/clé absente — jamais de undefined
// affiché, même si un dictionnaire est incomplet (voir CLAUDE.md).
function mergeWithFallback(dict) {
  const merged = {};
  for (const section of Object.keys(frDict)) {
    merged[section] = { ...frDict[section], ...(dict[section] || {}) };
  }
  return merged;
}

export function getDictionary(locale) {
  const safeLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  return mergeWithFallback(DICTS[safeLocale]);
}
