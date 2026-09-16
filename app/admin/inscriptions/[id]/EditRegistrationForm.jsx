"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["inscrit", "confirme", "paye_partiel", "paye_complet", "annule"];
const VISA_OPTIONS = ["non_demande", "en_cours", "accorde", "refuse"];

// canEditStatus/canEditFinance/canEditVisa restent basés sur le rôle brut
// (pas sur le système de permissions dynamique) : ce sont des restrictions
// fines par champ sur UN SEUL endpoint (PUT .../registrations/[id]), pas des
// permissions d'accès à une action — voir CLAUDE.md.
export default function EditRegistrationForm({ registration, role, canDelete }) {
  const router = useRouter();
  const [status, setStatus] = useState(registration.status);
  const [visaStatus, setVisaStatus] = useState(registration.visa_status);
  const [totalDue, setTotalDue] = useState(registration.total_due);
  const [notes, setNotes] = useState(registration.notes || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canEditStatus = ["direction", "ventes"].includes(role);
  const canEditFinance = ["direction", "comptabilite"].includes(role);
  const canEditVisa = ["direction", "suivi"].includes(role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {};
    if (canEditStatus) payload.status = status;
    if (canEditVisa) payload.visaStatus = visaStatus;
    if (canEditFinance) payload.totalDue = Number(totalDue);
    payload.notes = notes;

    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}`, {
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

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement cette inscription ?")) return;
    await fetch(`/api/admin/registrations/${registration.id}`, { method: "DELETE" });
    router.push("/admin/inscriptions");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select
            disabled={!canEditStatus}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut visa</label>
          <select
            disabled={!canEditVisa}
            value={visaStatus}
            onChange={(e) => setVisaStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Montant dû (MAD)</label>
        <input
          type="number"
          step="0.01"
          disabled={!canEditFinance}
          value={totalDue}
          onChange={(e) => setTotalDue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer l&apos;inscription
          </button>
        )}
      </div>
    </form>
  );
}
