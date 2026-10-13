"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { useAdminLocale } from "../../_components/AdminLocale";
import { GUIDE_PILLARS, GUIDE_PILLAR_LABELS } from "@/lib/editorial";

// Lexique bilingue (vague 2B du référencement).

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";

const toForm = (t) => ({
  termFr: t?.term_fr || "",
  termAr: t?.term_ar || "",
  definitionFr: t?.definition_fr || "",
  definitionAr: t?.definition_ar || "",
  slug: t?.slug || "",
  pillar: t?.pillar || "general",
  status: t?.status || "brouillon",
});

function TermForm({ initial, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(() => toForm(initial));
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Terme (français)</label>
          <input value={form.termFr} onChange={set("termFr")} dir="ltr" placeholder="ex. Ihram" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Terme (arabe)</label>
          <input value={form.termAr} onChange={set("termAr")} dir="rtl" lang="ar" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Définition (français)</label>
          <textarea value={form.definitionFr} onChange={set("definitionFr")} rows={4} dir="ltr" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Définition (arabe)</label>
          <textarea value={form.definitionAr} onChange={set("definitionAr")} rows={4} dir="rtl" lang="ar" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Slug (ancre) — vide = créé depuis le terme français</label>
          <input value={form.slug} onChange={set("slug")} dir="ltr" placeholder="ex. ihram" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Pilier</label>
          <select value={form.pillar} onChange={set("pillar")} className={input}>
            {GUIDE_PILLARS.map((p) => (
              <option key={p} value={p}>
                {GUIDE_PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select value={form.status} onChange={set("status")} className={input}>
            <option value="brouillon">Brouillon</option>
            <option value="publie">Publié</option>
          </select>
        </div>
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

export default function GlossaryManager({ initialTerms }) {
  const { tr } = useAdminLocale();
  const [terms, setTerms] = useState(initialTerms);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  async function send(url, method, body) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action impossible");
      setTerms(data.terms);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const shown = terms.filter(
    (t) => !filter || `${t.term_fr || ""} ${t.term_ar || ""} ${t.slug}`.toLowerCase().includes(filter.toLowerCase())
  );
  const missing = (t) => (!t.term_fr || !t.definition_fr ? "FR" : !t.term_ar || !t.definition_ar ? "AR" : null);

  return (
    <section className="gf-card overflow-hidden">
      <div className="gf-card-head gf-divided">
        <h2 className="gf-card-title">
          <Icon name="translate" size={18} />
          {tr("Termes ({count})", { count: terms.length })}
        </h2>
        <div className="flex gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher" className="rounded-md border px-3 py-1.5 text-sm" />
          <button type="button" className="gf-btn-primary" onClick={() => setEditing({ initial: null })}>
            <Icon name="add" size={16} />
            Nouveau terme
          </button>
        </div>
      </div>
      {error && !editing && <p className="mx-5 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {shown.length === 0 ? (
        <div className="gf-empty">Aucun terme.</div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {shown.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-zinc-900" translate="no">
                  {t.term_fr || "—"}
                  <span className="ms-2 text-zinc-500" dir="rtl">
                    {t.term_ar || ""}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span translate="no">#{t.slug}</span>
                  <span>{GUIDE_PILLAR_LABELS[t.pillar]}</span>
                  <span className="gf-pill" style={t.status === "publie" ? { background: "#e6f4ee", color: "#0f6b4b" } : { background: "#f1f1ee", color: "#5a5a60" }}>
                    {t.status === "publie" ? "Publié" : "Brouillon"}
                  </span>
                  {missing(t) === "FR" && <span className="text-amber-700">Version française manquante</span>}
                  {missing(t) === "AR" && <span className="text-amber-700">Version arabe manquante</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="gf-btn-icon" aria-label="Modifier" onClick={() => setEditing({ id: t.id, initial: t })}>
                  <Icon name="edit" size={18} />
                </button>
                <button
                  type="button"
                  className="gf-btn-icon gf-danger"
                  aria-label="Supprimer"
                  onClick={async () => {
                    if (await confirm("Supprimer ce terme ?")) send(`/api/admin/glossary/${t.id}`, "DELETE");
                  }}
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal title={editing.id ? "Modifier le terme" : "Nouveau terme"} onClose={() => setEditing(null)} size="lg">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <TermForm
            initial={editing.initial}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (form) => {
              const ok = editing.id ? await send(`/api/admin/glossary/${editing.id}`, "PUT", form) : await send("/api/admin/glossary", "POST", form);
              if (ok) setEditing(null);
            }}
          />
        </Modal>
      )}
      {confirmDialog}
    </section>
  );
}
