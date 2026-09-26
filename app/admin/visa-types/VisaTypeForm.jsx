"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

export default function VisaTypeForm({ visaType, programs, canDelete }) {
  const router = useRouter();
  const isEdit = !!visaType;

  const [name, setName] = useState(visaType?.name || "");
  const [country, setCountry] = useState(visaType?.country || "");
  const [programId, setProgramId] = useState(visaType?.program_id || "");
  const [price, setPrice] = useState(visaType?.price ?? 0);
  const [description, setDescription] = useState(visaType?.description || "");
  const [documents, setDocuments] = useState(
    visaType?.documents?.length
      ? visaType.documents.map((d) => ({ name: d.document_name, isRequired: !!d.is_required }))
      : [{ name: "", isRequired: true }]
  );
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const updateDocument = (index, field, value) => {
    setDocuments((docs) =>
      docs.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const addDocumentRow = () =>
    setDocuments((docs) => [...docs, { name: "", isRequired: true }]);

  const removeDocumentRow = (index) =>
    setDocuments((docs) => docs.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      country: country || null,
      programId: programId || null,
      price: Number(price),
      description: description || null,
      documents: documents.filter((d) => d.name.trim()),
    };

    try {
      const url = isEdit ? `/api/admin/visa-types/${visaType.id}` : "/api/admin/visa-types";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }

      router.push("/admin/visa-types");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm("Supprimer ce type de visa ?"))) return;
    await fetch(`/api/admin/visa-types/${visaType.id}`, { method: "DELETE" });
    router.push("/admin/visa-types");
    router.refresh();
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Visa Omra Arabie Saoudite"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Pays</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Prix (MAD)</label>
          <input
            type="number"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Programme (laisser vide = réutilisable pour tous les programmes)
        </label>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Tous programmes</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Documents requis</label>
        <div className="mt-2 space-y-2">
          {documents.map((doc, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={doc.name}
                onChange={(e) => updateDocument(index, "name", e.target.value)}
                placeholder="ex: Copie passeport"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={doc.isRequired}
                  onChange={(e) => updateDocument(index, "isRequired", e.target.checked)}
                />
                Obligatoire
              </label>
              <button
                type="button"
                onClick={() => removeDocumentRow(index)}
                className="text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDocumentRow}
          className="mt-2 text-sm text-emerald-700 hover:underline"
        >
          + Ajouter un document
        </button>
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
        {isEdit && canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer ce type de visa
          </button>
        )}
      </div>
    </form>
    {confirmDialog}
    </>
  );
}
