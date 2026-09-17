"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = ["non_demande", "en_cours", "accorde", "refuse"];

export default function VisaServiceManager({ visaService, canManage }) {
  const router = useRouter();
  const [status, setStatus] = useState(visaService.status);
  const [notes, setNotes] = useState(visaService.notes || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/visa-services/${visaService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
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

  const toggleDocument = async (doc) => {
    if (!canManage) return;
    const nextStatus = doc.status === "fourni" ? "manquant" : "fourni";
    await fetch(`/api/admin/visa-service-documents/${doc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Suivi de la demande</h2>

      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select
            disabled={!canManage}
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
          <label className="block text-sm font-medium text-zinc-700">Notes</label>
          <textarea
            disabled={!canManage}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
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
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <h3 className="mt-6 text-sm font-semibold text-zinc-900">Documents requis</h3>
      <ul className="mt-2 space-y-2">
        {visaService.documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between text-sm">
            <span>
              {doc.document_name}
              {!doc.is_required && (
                <span className="ml-1 text-xs text-zinc-400">(optionnel)</span>
              )}
            </span>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => toggleDocument(doc)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                doc.status === "fourni"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              } ${canManage ? "cursor-pointer" : "cursor-default"}`}
            >
              {doc.status === "fourni" ? "Fourni" : "Manquant"}
            </button>
          </li>
        ))}
        {visaService.documents.length === 0 && (
          <li className="text-sm text-zinc-500">Aucun document requis pour ce type de visa.</li>
        )}
      </ul>
    </div>
  );
}
