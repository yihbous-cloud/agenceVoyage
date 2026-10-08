"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VISA_OPTIONS = ["non_demarre", "en_cours", "accorde", "refuse"];

// Carte "Visa" légère : statut visa (déjà existant, simple indicateur
// manuel — voir CLAUDE.md §3sedecies) + rappel lecture-seule du passeport,
// extrait d'EditRegistrationForm.jsx pour aligner l'UI sur la restriction
// déjà existante par rôle (`suivi` ne peut envoyer que visaStatus/notes,
// §3undecies). Réutilisable tel quel par la fiche individuelle et, une
// instance par membre, par la page groupe (le statut visa reste individuel
// même au sein d'un groupe, §3trevicies).
export default function VisaStatusForm({
  apiBasePath,
  visaStatus,
  passportNumber,
  passportExpiryDate,
  canManage,
}) {
  const router = useRouter();
  const [value, setValue] = useState(visaStatus);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiBasePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visaStatus: value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la mise à jour");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Statut visa</label>
        <select
          disabled={!canManage}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        >
          {VISA_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {canManage && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
      <p className="w-full text-sm text-zinc-500">
        Passeport : {passportNumber || "—"}
        {passportExpiryDate ? ` — expire le ${passportExpiryDate}` : ""}
      </p>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
