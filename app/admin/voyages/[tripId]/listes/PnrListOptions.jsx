"use client";

import { useState } from "react";
import {
  PNR_LIST_COLUMNS,
  HEADER_LANGUAGES,
  PDF_ORIENTATIONS,
  getFormatOptions,
  getDefaultFormatKey,
} from "@/lib/pnrListColumns";

// Choix du contenu de la liste compagnie (PNR) : colonnes à inclure, format
// d'affichage de chaque information (dates, genre, noms, passeport,
// téléphone — l'exemple affiché dans la liste est le rendu réel du fichier),
// langue des en-têtes, numérotation et orientation du PDF.
export default function PnrListOptions({ baseHref }) {
  const [selected, setSelected] = useState(
    () => new Set(PNR_LIST_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );
  const [formats, setFormats] = useState({});
  const [lang, setLang] = useState("fr");
  const [orientation, setOrientation] = useState("auto");
  const [numbered, setNumbered] = useState(false);

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const activeColumns = PNR_LIST_COLUMNS.filter((c) => selected.has(c.key));
  const params = new URLSearchParams();
  params.set("columns", activeColumns.map((c) => c.key).join(","));
  const formatPairs = activeColumns
    .filter((c) => c.type && formats[c.key])
    .map((c) => `${c.key}:${formats[c.key]}`);
  if (formatPairs.length > 0) params.set("f", formatPairs.join(","));
  params.set("lang", lang);
  params.set("orient", orientation);
  if (numbered) params.set("num", "1");

  const disabled = selected.size === 0;
  const linkClass = (primary) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${
      primary
        ? "bg-emerald-700 text-white hover:bg-emerald-800"
        : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
    } ${disabled ? "pointer-events-none opacity-50" : ""}`;
  const selectClass = "rounded-lg border border-zinc-300 px-2 py-1 text-sm";

  return (
    <div className="space-y-5">
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {PNR_LIST_COLUMNS.map((c) => {
          const checked = selected.has(c.key);
          const options = checked ? getFormatOptions(c) : [];
          return (
            <div key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="flex min-w-[190px] items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.key)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                {c.header}
              </label>
              {options.length > 0 && (
                <select
                  aria-label={`Format — ${c.header}`}
                  value={formats[c.key] || getDefaultFormatKey(c)}
                  onChange={(e) => setFormats((f) => ({ ...f, [c.key]: e.target.value }))}
                  className={selectClass}
                >
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {c.key === "full_name_arabic" && checked && (
                <span className="text-xs text-zinc-400">Excel uniquement (absent du PDF)</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-zinc-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          Langue des en-têtes
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
            {HEADER_LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          Orientation du PDF
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            className={selectClass}
          >
            {PDF_ORIENTATIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={numbered}
            onChange={(e) => setNumbered(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Numéroter les lignes
        </label>
      </div>

      <div className="flex gap-3">
        <a href={`${baseHref}?format=xlsx&${params}`} className={linkClass(true)}>
          Télécharger Excel
        </a>
        <a href={`${baseHref}?format=pdf&${params}`} className={linkClass(false)}>
          Télécharger PDF
        </a>
      </div>
    </div>
  );
}
