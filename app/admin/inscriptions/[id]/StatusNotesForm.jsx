"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["inscrit", "confirme", "paye_partiel", "paye_complet", "annule"];

// Statut : "toujours modifiable" — jamais soumis au cycle Afficher/Modifier
// du reste de la carte "Hébergement et Paiement" (§3soixantetroisquadragies)
// — ET actualisé automatiquement depuis les paiements
// (lib/paymentStatus.js::computePaymentStatus : partiel/complet/annulé
// si remboursement total). Le useEffect resynchronise la valeur affichée à
// chaque nouvelle valeur reçue du serveur (après un ajout/suppression de
// paiement dans la même modale), sans empêcher une correction manuelle
// explicite via "Enregistrer" ensuite.
export default function StatusNotesForm({ apiBasePath, status, notes, role }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [notesValue, setNotesValue] = useState(notes || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue(status);
  }, [status]);

  const canEditStatus = ["direction", "ventes"].includes(role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = { notes: notesValue };
      if (canEditStatus) payload.status = value;
      const res = await fetch(apiBasePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="max-w-xs">
        <label className="block text-sm font-medium text-zinc-700">Statut</label>
        <select
          disabled={!canEditStatus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-400">
          Recalculé automatiquement selon les paiements (partiel/complet/annulé si
          remboursement total) — modifiable manuellement à tout moment.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
