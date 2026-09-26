"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isValidLocale, isRtl } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/getDictionary";

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  dict: getDictionary(DEFAULT_LOCALE),
  dir: "ltr",
  setLocale: () => {},
});

function readCookieLocale() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]+)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isValidLocale(value) ? value : DEFAULT_LOCALE;
}

// Entièrement client — volontairement pas de lecture du cookie côté serveur
// (dans app/(site)/layout.js) : cookies()/headers() côté serveur force tout
// l'arbre de rendu en dynamique (perte du rendu statique/ISR sur toutes les
// pages publiques, régression constatée lors de l'implémentation — voir
// CLAUDE.md). Ici, le rendu serveur reste fr/ltr (identique à avant), et ce
// composant corrige lang/dir après montage — léger effet de "flash" fr au
// premier chargement si une autre langue avait été choisie, accepté comme
// compromis pour préserver le rendu statique (priorité SEO du projet).
export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readCookieLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!isValidLocale(next)) return;
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(next);
  }, []);

  const dict = getDictionary(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <LocaleContext.Provider value={{ locale, dict, dir, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
