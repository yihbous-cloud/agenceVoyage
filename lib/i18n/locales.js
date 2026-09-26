// Langues préparées pour le site public (§CLAUDE.md) — le changement de
// langue se fait par cookie, sans préfixe d'URL (/fr/, /ar/ restent un
// chantier futur documenté, une fois une vraie traduction arabe prête).
export const SUPPORTED_LOCALES = ["fr", "en", "ar"];
export const DEFAULT_LOCALE = "fr";
export const LOCALE_COOKIE_NAME = "gf_locale";

export function isValidLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

export function isRtl(locale) {
  return locale === "ar";
}
