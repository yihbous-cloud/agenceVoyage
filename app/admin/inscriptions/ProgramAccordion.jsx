"use client";

import { createContext, useContext, useRef, useState } from "react";
import Icon from "../_components/Icon";

// Accordéon des voyages de /admin/inscriptions : un seul tableau ouvert à la
// fois — ouvrir un programme referme automatiquement les autres ; recliquer
// sur le programme ouvert le referme. Le contenu (tableau) est rendu côté
// serveur et simplement passé en children (charte : designadmin.md).
const AccordionContext = createContext(null);

export function AccordionGroup({ defaultOpenId, children }) {
  const [openId, setOpenId] = useState(defaultOpenId ?? null);
  return (
    <AccordionContext.Provider value={{ openId, setOpenId }}>
      <div className="flex flex-col gap-3">{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ id, title, date, count, stats = [], archived = false, children }) {
  const { openId, setOpenId } = useContext(AccordionContext);
  const open = openId === id;
  const ref = useRef(null);

  const toggle = () => {
    setOpenId(open ? null : id);
    if (!open) {
      // Après l'animation de fermeture des autres sections, ramène l'en-tête
      // ouvert dans la vue s'il est sorti de l'écran.
      setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top < 70 || top > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 280);
    }
  };

  return (
    <section ref={ref} className="gf-card gf-accordion overflow-hidden" data-open={open} style={{ scrollMarginTop: 16 }}>
      <button type="button" onClick={toggle} aria-expanded={open} className="gf-accordion-head">
        <span className="gf-accordion-icon">
          <Icon name={archived ? "inventory_2" : "mosque"} size={18} fill={open} />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span style={{ fontSize: 14.5, fontWeight: 600 }} translate="no">
            {title}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--gf-subtle)" }}>{date}</span>
          {archived && (
            <span className="gf-pill" style={{ background: "#f1f1ee", color: "#5a5a60" }}>
              Clôturé
            </span>
          )}
        </span>
        <span className="gf-hide-mobile flex items-center gap-1.5">
          {stats
            .filter((s) => s.value > 0)
            .map((s) => (
              <span key={s.label} className="gf-pill" style={{ background: s.bg, color: s.fg }}>
                {s.label} · {s.value}
              </span>
            ))}
        </span>
        <span className="gf-tag" style={{ fontVariantNumeric: "tabular-nums" }}>
          {count}
        </span>
        <Icon name="expand_more" size={22} className="gf-accordion-chevron" />
      </button>
      <div className="gf-accordion-panel">
        <div>
          <div style={{ borderTop: "1px solid var(--gf-border-soft)" }}>{children}</div>
        </div>
      </div>
    </section>
  );
}
