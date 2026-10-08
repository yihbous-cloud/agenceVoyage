"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { LOCALE_COOKIE_NAME, LOCALE_LABELS, SUPPORTED_LOCALES, localizePath, stripLocalePrefix } from "@/lib/i18n/locales";

export default function LanguageSwitcher() {
  const { locale, tr } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Même page, autre langue : on retire le préfixe courant puis on pose celui
  // de la langue choisie (aucun préfixe pour l'arabe). Le cookie mémorise le
  // choix pour l'espace interne (/admin), qui n'a pas d'URL par langue.
  const handleChange = (next) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    const { path } = stripLocalePrefix(pathname);
    // window.location plutôt que useSearchParams : ce composant vit dans le
    // layout, useSearchParams y exigerait une frontière Suspense et
    // dégraderait le rendu statique de toutes les pages.
    router.push(`${localizePath(path, next)}${window.location.search}`);
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={tr("Langue")}
      className="rounded border border-gold/40 bg-transparent px-2 py-1.5 text-xs font-medium text-cream-card/90 hover:border-gold"
    >
      {SUPPORTED_LOCALES.map((value) => (
        <option key={value} value={value} className="bg-ink text-cream-card">
          {LOCALE_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
