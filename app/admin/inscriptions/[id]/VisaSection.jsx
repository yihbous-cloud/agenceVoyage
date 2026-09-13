"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VisaSection({ registrationId, visaTypes, visaRequest, role }) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = ["direction", "suivi"].includes(role);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedType) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/visa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visaTypeId: selectedType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur");
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
    await fetch(`/api/admin/visa-documents/${doc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Visa</h2>

      {!visaRequest?.visa_type_id && (
        <>
          {canManage ? (
            <form onSubmit={handleAssign} className="mt-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700">
                  Type de visa
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner...</option>
                  {visaTypes.map((vt) => (
                    <option key={vt.id} value={vt.id}>
                      {vt.name} — {vt.price} MAD
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting || !selectedType}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                Assigner
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Aucun type de visa assigné.</p>
          )}
        </>
      )}

      {visaRequest?.visa_type_id && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-600">
            Documents requis :
          </p>
          <ul className="space-y-2">
            {visaRequest.documents.map((doc) => (
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
          </ul>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
