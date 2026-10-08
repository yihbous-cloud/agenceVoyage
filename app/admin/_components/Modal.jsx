"use client";

import { useEffect } from "react";
import Icon from "./Icon";

// Modale générique de l'espace interne (charte designadmin.md) : voile flouté,
// boîte blanche 16px, en-tête collant avec titre et bouton fermer. Partagée
// entre plusieurs pages admin (voir CLAUDE.md).
export default function Modal({ title, onClose, children, size = "md" }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const maxWidth = size === "xl" ? 1040 : size === "lg" ? 760 : size === "sm" ? 440 : 620;

  return (
    <div className="gf-overlay" onClick={onClose}>
      <div className="gf-dialog" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="gf-dialog-head">
          <h2 className="gf-dialog-title">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer" className="gf-btn-icon">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="gf-dialog-body">{children}</div>
      </div>
    </div>
  );
}
