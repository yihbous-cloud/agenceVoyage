"use client";

import Link from "next/link";
import Icon from "./Icon";

// Tuile compacte cliquable (titre + sous-titre) — ouvre soit une modale
// (onClick), soit navigue directement (href) quand le module renvoie vers
// une autre page plutôt que d'afficher un formulaire ici (ex. "Gérer depuis
// le groupe →"). Partagé entre plusieurs pages admin (programmes,
// inscriptions, groupes — voir CLAUDE.md). Charte : designadmin.md (.gf-tile).
// Optionnels : `badge` ({ label, bg, fg }) — pastille de statut à droite du
// titre ; `meta` — seconde ligne discrète sous le sous-titre.
export default function ModuleTile({ title, subtitle, meta, badge, onClick, href, icon }) {
  const content = (
    <>
      {icon && (
        <span className="gf-tile-icon">
          <Icon name={icon} size={19} />
        </span>
      )}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</span>
          {badge && (
            <span className="gf-pill" style={{ background: badge.bg, color: badge.fg }}>
              {badge.label}
            </span>
          )}
        </span>
        {subtitle != null && (
          <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "var(--gf-text-2)" }}>{subtitle}</span>
        )}
        {meta && (
          <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--gf-subtle)" }}>{meta}</span>
        )}
      </span>
      <Icon
        name={href ? "open_in_new" : "chevron_right"}
        size={18}
        className="gf-tile-arrow"
        style={{ color: "var(--gf-faint)", alignSelf: "center" }}
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="gf-tile">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="gf-tile">
      {content}
    </button>
  );
}
