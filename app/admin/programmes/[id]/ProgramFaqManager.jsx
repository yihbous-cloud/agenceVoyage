"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function FaqForm({ initial, onSubmit, onCancel, submitting }) {
  const [question, setQuestion] = useState(initial?.question || "");
  const [answer, setAnswer] = useState(initial?.answer || "");
  const [isPublished, setIsPublished] = useState(initial?.is_published !== false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ question, answer, isPublished });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Question</label>
        <input
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="ex: Combien coûte le voyage depuis Casablanca ?"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Réponse</label>
        <textarea
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Publiée (visible sur la fiche programme)
      </label>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          Enregistrer
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function ProgramFaqManager({ programId, initialFaqs, canManage }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${programId}/faqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur lors de l'ajout");
      }
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/program-faqs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur lors de la modification");
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette question ?")) return;
    await fetch(`/api/admin/program-faqs/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {initialFaqs.map((faq) =>
          editingId === faq.id ? (
            <FaqForm
              key={faq.id}
              initial={faq}
              submitting={submitting}
              onCancel={() => setEditingId(null)}
              onSubmit={(data) => handleUpdate(faq.id, data)}
            />
          ) : (
            <div key={faq.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900">{faq.question}</p>
                  <p className="mt-1 text-sm text-zinc-600">{faq.answer}</p>
                  {!faq.is_published && (
                    <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      Brouillon
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button
                      onClick={() => setEditingId(faq.id)}
                      className="text-emerald-700 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {initialFaqs.length === 0 && !adding && (
          <p className="text-sm text-zinc-500">Aucune question pour ce programme.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage &&
        (adding ? (
          <FaqForm
            submitting={submitting}
            onCancel={() => setAdding(false)}
            onSubmit={handleCreate}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            + Ajouter une question
          </button>
        ))}
    </div>
  );
}
