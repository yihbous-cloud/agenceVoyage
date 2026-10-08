"use client";

import { LOCALE_COOKIE_NAME, LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { useAdminLocale } from "./AdminLocale";

// L'espace interne n'a pas d'URL par langue : le choix est mémorisé dans le
// cookie (partagé avec le site public) puis la page est rechargée, le layout
// serveur relisant le cookie pour fixer lang/dir.
// variant="sidebar" : version compacte (AR/FR/EN) de la barre latérale sombre.
export default function AdminLanguageSwitcher({ className = "", variant = "default" }) {
  const { locale, tr } = useAdminLocale();

  const handleChange = (next) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  const isSidebar = variant === "sidebar";

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={tr("Langue")}
      title={tr("Langue")}
      translate="no"
      className={
        isSidebar
          ? `gf-sb-outline ${className}`
          : `h-9 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 ${className}`
      }
    >
      {SUPPORTED_LOCALES.map((value) => (
        <option key={value} value={value} translate="no">
          {isSidebar ? value.toUpperCase() : LOCALE_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
