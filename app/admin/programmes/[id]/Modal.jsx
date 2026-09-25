"use client";

import { useEffect } from "react";

// Même habillage que la modale de confirmation passeport
// (TravelerFields.jsx) — fond noir semi-transparent, boîte blanche
// centrée — généralisé ici avec un titre et un bouton fermer.
export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg px-2 py-1 text-xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
