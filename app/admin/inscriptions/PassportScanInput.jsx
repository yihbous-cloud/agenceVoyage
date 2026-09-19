"use client";

import { useState } from "react";
import { parsePassportMrz } from "@/lib/mrzParser";

// Remplissage automatique depuis un lecteur de passeport USB (voir
// CLAUDE.md) : la plupart des lecteurs bon marché se comportent comme un
// clavier et "tapent" les 2 lignes du code MRZ (zone lisible en bas de la
// page passeport) dans le champ actif — il suffit d'y placer le curseur
// avant de scanner. Fonctionne aussi en collant le code MRZ manuellement.
export default function PassportScanInput({ onScan, disabled }) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    const value = e.target.value;
    setRaw(value);
    const parsed = parsePassportMrz(value);
    if (!parsed) {
      setResult(null);
      return;
    }
    setResult(
      parsed.valid
        ? { ok: true, message: `Passeport scanné : ${parsed.fullName} — ${parsed.passportNumber}` }
        : {
            ok: false,
            message: `Lecture douteuse (à vérifier : ${parsed.warnings.join(
              ", "
            )}) — champs pré-remplis, vérifiez-les avant de valider.`,
          }
    );
    onScan(parsed);
  };

  if (disabled) return null;

  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-3">
      <label className="block text-sm font-medium text-zinc-700">Scanner le passeport</label>
      <p className="mt-0.5 text-xs text-zinc-500">
        Placez le curseur ici puis scannez la page du passeport avec le lecteur — les champs se
        remplissent automatiquement. Vous pouvez aussi coller le code MRZ (2 lignes en bas de la
        page passeport).
      </p>
      <textarea
        value={raw}
        onChange={handleChange}
        rows={2}
        placeholder="P<MARDUPONT<<JEAN<<<<<<<<<<<<<<<<<<<<<<<<<<
AB1234567MAR8501019M3001014<<<<<<<<<<<<<<02"
        className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs uppercase"
      />
      {result && (
        <p className={`mt-1 text-xs ${result.ok ? "text-emerald-700" : "text-amber-600"}`}>
          {result.ok ? "✓ " : "⚠ "}
          {result.message}
        </p>
      )}
    </div>
  );
}
