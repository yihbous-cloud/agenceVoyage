"use client";

import { useLocale } from "./LocaleProvider";

const OPTIONS = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
  { value: "ar", label: "AR" },
];

export default function LanguageSwitcher() {
  const { locale, dict, setLocale } = useLocale();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      aria-label={dict.langSwitcher.label}
      className="rounded border border-gold/40 bg-transparent px-2 py-1.5 text-xs font-medium text-cream-card/90 hover:border-gold"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink text-cream-card">
          {o.label}
        </option>
      ))}
    </select>
  );
}
