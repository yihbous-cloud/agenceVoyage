"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { formatDateTime } from "../labels";

const CATEGORY_LABELS = {
  documents: "Documents",
  bagages: "Bagages",
  vaccins: "Vaccins",
  paiement: "Paiement",
  deroulement: "Déroulement",
  agence: "Agence",
  autre: "Autre",
};

const EMPTY = { category: "documents", question: "", variants: "", answerFr: "", answerAr: "", status: "brouillon" };

function ItemForm({ initial, categories, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Catégorie
          <select value={form.category} onChange={set("category")} className="mt-1 w-full rounded-md border px-3 py-2">
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Statut
          <select value={form.status} onChange={set("status")} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="brouillon">Brouillon (inconnu de l&apos;IA)</option>
            <option value="publie">Publié</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Question
        <input required value={form.question} onChange={set("question")} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
      </label>
      <label className="block text-sm">
        Variantes de formulation (une par ligne, darija comprise)
        <textarea value={form.variants} onChange={set("variants")} rows={3} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Réponse (français)
          <textarea value={form.answerFr} onChange={set("answerFr")} rows={5} className="mt-1 w-full rounded-md border px-3 py-2" dir="ltr" />
        </label>
        <label className="text-sm">
          Réponse (arabe)
          <textarea value={form.answerAr} onChange={set("answerAr")} rows={5} className="mt-1 w-full rounded-md border px-3 py-2" dir="rtl" />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="gf-btn-primary">
          Enregistrer
        </button>
        <button type="button" className="gf-btn-outline" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function KnowledgeManager({ initialItems, initialUnanswered, categories }) {
  const [items, setItems] = useState(initialItems);
  const [unanswered, setUnanswered] = useState(initialUnanswered);
  const [editing, setEditing] = useState(null); // { id?, initial, unansweredId? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  async function post(payload) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action impossible");
      setItems(data.items);
      setUnanswered(data.unanswered);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const shown = items.filter((i) => !filter || `${i.question} ${i.variants || ""} ${i.answer_fr || ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="gf-card overflow-hidden lg:col-span-2">
        <div className="gf-card-head gf-divided">
          <h2 className="gf-card-title">
            <Icon name="menu_book" size={18} />
            {`Fiches (${items.length})`}
          </h2>
          <div className="flex gap-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher" className="rounded-md border px-3 py-1.5 text-sm" />
            <button type="button" className="gf-btn-primary" onClick={() => setEditing({ initial: EMPTY })}>
              <Icon name="add" size={16} />
              Nouvelle fiche
            </button>
          </div>
        </div>
        {error && <p className="mx-5 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {shown.length === 0 ? (
          <div className="gf-empty">Aucune fiche. Ajoutez les réponses validées par l&apos;agence (documents requis, bagages, paiement...).</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {shown.map((i) => (
              <li key={i.id} className="px-5 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="font-medium" translate="no">{i.question}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="gf-chip">{CATEGORY_LABELS[i.category] || i.category}</span>
                      <span className="gf-pill" style={i.status === "publie" ? { background: "#e6f4ee", color: "#0f6b4b" } : { background: "#f1f1ee", color: "#5a5a60" }}>
                        {i.status === "publie" ? "Publié" : "Brouillon"}
                      </span>
                      <span>Vérifiée le {i.verified_at ? formatDateTime(i.verified_at, { year: "numeric", hour: undefined, minute: undefined }) : "—"}</span>
                      {i.needs_review && <span className="text-amber-700">À revérifier (plus de 6 mois)</span>}
                    </div>
                    {i.answer_fr && <p className="mt-1 line-clamp-2 text-xs text-zinc-600" translate="no">{i.answer_fr}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="gf-btn-icon"
                      aria-label="Modifier"
                      onClick={() =>
                        setEditing({
                          id: i.id,
                          initial: { category: i.category, question: i.question, variants: i.variants || "", answerFr: i.answer_fr || "", answerAr: i.answer_ar || "", status: i.status },
                        })
                      }
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      className="gf-btn-icon gf-danger"
                      aria-label="Supprimer"
                      onClick={async () => {
                        if (await confirm("Supprimer cette fiche ?")) post({ action: "delete", id: i.id });
                      }}
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="gf-card h-fit overflow-hidden">
        <div className="gf-card-head gf-divided">
          <h2 className="gf-card-title">
            <Icon name="help" size={18} />
            {`Questions sans réponse (${unanswered.length})`}
          </h2>
        </div>
        {unanswered.length === 0 ? (
          <div className="gf-empty">Rien à traiter.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {unanswered.map((u) => (
              <li key={u.id} className="px-4 py-3 text-sm">
                <div translate="no">{u.question}</div>
                {u.correction && <div className="mt-1 text-xs text-zinc-600">Correction : <span translate="no">{u.correction}</span></div>}
                <div className="mt-1 text-xs text-zinc-500">
                  {u.origin === "correction" ? "Correction d'un conseiller" : "Transfert"} · {formatDateTime(u.created_at)}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="gf-btn-soft"
                    onClick={() => setEditing({ unansweredId: u.id, initial: { ...EMPTY, question: u.question, answerFr: u.correction || "" } })}
                  >
                    Créer une fiche
                  </button>
                  <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={() => post({ action: "dismiss", id: u.id })}>
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {editing && (
        <Modal title={editing.id ? "Modifier la fiche" : "Nouvelle fiche"} onClose={() => setEditing(null)}>
          <ItemForm
            initial={editing.initial}
            categories={categories}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (item) => {
              const okay = editing.id
                ? await post({ action: "update", id: editing.id, item })
                : await post({ action: "create", item: { ...item, unansweredId: editing.unansweredId } });
              if (okay) setEditing(null);
            }}
          />
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
