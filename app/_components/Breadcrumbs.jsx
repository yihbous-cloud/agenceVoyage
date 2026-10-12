import Link from "next/link";
import { localizePath } from "@/lib/i18n/locales";

// Fil d'Ariane VISIBLE (TECH-16 du cahier des charges référencement).
// items : [{ name, href? }] — `href` est un chemin SANS préfixe de langue
// ("/omra") ; le dernier élément (page courante) n'en a pas. Son balisage
// BreadcrumbList fait partie du bloc JSON-LD unique de la page
// (PageJsonLd, prop `breadcrumb` — les mêmes éléments).
// `label` : nom accessible du <nav>, traduit par l'appelant
// (tr("Fil d'Ariane")).
export default function Breadcrumbs({ items, locale, label, className = "", tone = "light" }) {
  const linkClass = tone === "dark" ? "text-white/60 hover:text-gold" : "text-muted hover:text-ink";
  const currentClass = tone === "dark" ? "text-white/85" : "text-ink";
  const separatorClass = tone === "dark" ? "text-white/30" : "text-gold-pale";

  return (
    <nav aria-label={label} className={`text-xs ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className={separatorClass}>
                /
              </span>
            )}
            {entry.href ? (
              <Link href={localizePath(entry.href, locale)} className={linkClass}>
                {entry.name}
              </Link>
            ) : (
              <span aria-current="page" className={currentClass}>
                {entry.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
