"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, INTL_TAGS, isRtl } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  dir: "rtl",
  intlTag: INTL_TAGS[DEFAULT_LOCALE],
  tr: makeTranslator(DEFAULT_LOCALE),
});

// La langue vient de l'URL (préfixe /fr, /en ; arabe = pas de préfixe), lue
// côté serveur par le layout et passée en prop — jamais d'un cookie ici :
// le rendu serveur est donc DÉJÀ dans la bonne langue (SEO), sans "flash"
// de changement de langue après hydratation.
// brandName : nom de l'agence (multi-agences) — remplace "Golden Fantastic"
// dans les textes du dictionnaire (voir lib/i18n/translate.js).
export function LocaleProvider({ locale, brandName, children }) {
  const value = useMemo(
    () => ({
      locale,
      dir: isRtl(locale) ? "rtl" : "ltr",
      intlTag: INTL_TAGS[locale] || INTL_TAGS[DEFAULT_LOCALE],
      tr: makeTranslator(locale, "public", { brandName }),
    }),
    [locale, brandName]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
