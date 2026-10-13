"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

// Avis clients de la fiche voyage — bloc « Preuves » (vague 2A, CLAUDE.md
// §3centdixseptquadragies). Avis RÉELLEMENT reçus (WhatsApp, e-mail, livre
// d'or...), saisis par l'équipe. Publication impossible sans le
// consentement de l'auteur (contrôlé aussi côté serveur et en base).

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toForm = (review) => ({
  authorName: review?.author_name || "",
  authorCity: review?.author_city || "",
  rating: String(review?.rating || 5),
  body: review?.body || "",
  locale: review?.locale || "ar",
  reviewDate: review?.review_date ? String(review.review_date).slice(0, 10) : todayIso(),
  tripId: review?.trip_id ? String(review.trip_id) : "",
  consentGiven: Boolean(review?.consent_given),
  isPublished: Boolean(review?.is_published),
});

function ReviewForm({ initial, trips, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key, value) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === "consentGiven" && !value ? { isPublished: false } : {}) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ ...form, rating: Number(form.rating), tripId: form.tripId || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom de l&apos;auteur</label>
          <input required value={form.authorName} onChange={(e) => set("authorName", e.target.value)} dir="auto" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Ville (facultatif)</label>
          <input value={form.authorCity} onChange={(e) => set("authorCity", e.target.value)} dir="auto" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Note</label>
          <select value={form.rating} onChange={(e) => set("rating", e.target.value)} className={input}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n}/5)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Date de l&apos;avis</label>
          <input type="date" required max={todayIso()} value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Langue de l&apos;avis</label>
          <select value={form.locale} onChange={(e) => set("locale", e.target.value)} className={input}>
            <option value="ar">Arabe</option>
            <option value="fr">Français</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Départ concerné (facultatif)</label>
          <select value={form.tripId} onChange={(e) => set("tripId", e.target.value)} className={input}>
            <option value="">—</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.reference_code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Texte de l&apos;avis (tel que reçu)</label>
        <textarea required value={form.body} onChange={(e) => set("body", e.target.value)} rows={4} dir="auto" className={input} />
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={form.consentGiven} onChange={(e) => set("consentGiven", e.target.checked)} className="mt-1" />
        <span>Consentement de l&apos;auteur reçu pour publier son avis sur le site</span>
      </label>
      <label className={`flex items-start gap-2 text-sm ${form.consentGiven ? "text-zinc-700" : "text-zinc-400"}`}>
        <input
          type="checkbox"
          disabled={!form.consentGiven}
          checked={form.isPublished}
          onChange={(e) => set("isPublished", e.target.checked)}
          className="mt-1"
        />
        <span>Publier sur la fiche du programme</span>
      </label>
      {!form.consentGiven && <p className="text-xs text-amber-700">Sans consentement, l&apos;avis reste interne et n&apos;apparaît pas sur le site.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function ReviewsCard({ programId, initialReviews = [], trips = [], canManage }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [reviews, setReviews] = useState(initialReviews);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const send = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Erreur lors de l'enregistrement");
    setReviews(data.reviews);
    router.refresh();
  };

  const handleCreate = async (payload) => {
    await send(`/api/admin/programs/${programId}/reviews`, "POST", payload);
    setAdding(false);
  };

  const handleUpdate = async (id, payload) => {
    await send(`/api/admin/program-reviews/${id}`, "PUT", payload);
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Supprimer cet avis ?"))) return;
    setError(null);
    try {
      await send(`/api/admin/program-reviews/${id}`, "DELETE");
    } catch (err) {
      setError(err.message);
    }
  };

  const published = reviews.filter((r) => r.is_published && r.consent_given);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Saisissez uniquement des avis réellement reçus de vos voyageurs. Seuls les avis publiés, avec consentement, apparaissent sur le site et dans les résultats de recherche (note moyenne).
      </p>
      {published.length > 0 && (
        <p className="text-sm text-zinc-700">
          {tr("Note moyenne publiée : {note} / 5", {
            note: (published.reduce((sum, r) => sum + Number(r.rating), 0) / published.length).toFixed(1),
          })}
        </p>
      )}

      {reviews.length === 0 && !adding && <p className="text-sm text-zinc-500">Aucun avis pour l&apos;instant.</p>}

      <ul className="space-y-3">
        {reviews.map((r) =>
          editingId === r.id ? (
            <li key={r.id}>
              <ReviewForm initial={r} trips={trips} onSubmit={(payload) => handleUpdate(r.id, payload)} onCancel={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={r.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium text-zinc-900" translate="no" dir="auto">
                    {r.author_name}
                  </span>
                  {r.author_city && (
                    <span className="ms-1 text-zinc-500" translate="no" dir="auto">
                      · {r.author_city}
                    </span>
                  )}
                  <span className="ms-2 text-amber-600" aria-label={`${r.rating}/5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.is_published && r.consent_given
                      ? "bg-emerald-100 text-emerald-800"
                      : r.consent_given
                      ? "bg-zinc-100 text-zinc-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {r.is_published && r.consent_given ? "Publié" : r.consent_given ? "Non publié" : "Sans consentement"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700" translate="no" dir="auto">
                {r.body}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {String(r.review_date).slice(0, 10)}
                {r.reference_code ? ` · ${r.reference_code}` : ""}
              </p>
              {canManage && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button type="button" onClick={() => setEditingId(r.id)} className="font-medium text-emerald-700 hover:underline">
                    Modifier
                  </button>
                  <button type="button" onClick={() => handleDelete(r.id)} className="font-medium text-red-600 hover:underline">
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          )
        )}
      </ul>

      {canManage &&
        (adding ? (
          <ReviewForm trips={trips} onSubmit={handleCreate} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-emerald-700 hover:underline">
            + Ajouter un avis
          </button>
        ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {confirmDialog}
    </div>
  );
}
