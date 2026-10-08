// Langues du système. L'arabe est la langue PRINCIPALE (par défaut) :
//   - site public : l'arabe n'a pas de préfixe d'URL (/omra-hajj), le
//     français et l'anglais sont préfixés (/fr/omra-hajj, /en/omra-hajj) —
//     stratégie "préfixe si langue non par défaut"
//   - espace interne (/admin) : langue choisie via un cookie, arabe par défaut
// Fichier pur (aucun import) : utilisé côté serveur, client et proxy.
export const SUPPORTED_LOCALES = ["ar", "fr", "en"];
export const DEFAULT_LOCALE = "ar";
export const LOCALE_COOKIE_NAME = "gf_locale";

export const LOCALE_LABELS = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};

// Balises BCP 47 pour Intl/toLocaleDateString : "ar-MA" garde les chiffres
// latins (usage au Maroc) contrairement à "ar-SA" (chiffres arabes-indiens).
export const INTL_TAGS = { ar: "ar-MA", fr: "fr-FR", en: "en-GB" };

export function isValidLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

export function isRtl(locale) {
  return locale === "ar";
}

export function resolveLocale(value) {
  return isValidLocale(value) ? value : DEFAULT_LOCALE;
}

// Chemin public localisé : "/omra-hajj" → "/omra-hajj" (ar) ou "/fr/omra-hajj".
// `path` peut contenir une query/ancre ; "/" devient "/fr" (sans slash final).
export function localizePath(path, locale) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (!isValidLocale(locale) || locale === DEFAULT_LOCALE) return safePath;
  return safePath === "/" ? `/${locale}` : `/${locale}${safePath}`;
}

// Inverse : "/fr/omra-hajj" → { locale: "fr", path: "/omra-hajj" } ;
// un chemin sans préfixe est dans la langue par défaut.
export function stripLocalePrefix(pathname) {
  const match = /^\/(ar|fr|en)(?=\/|$)/.exec(pathname);
  if (!match) return { locale: DEFAULT_LOCALE, path: pathname || "/", hasPrefix: false };
  const rest = pathname.slice(match[0].length) || "/";
  return { locale: match[1], path: rest, hasPrefix: true };
}
