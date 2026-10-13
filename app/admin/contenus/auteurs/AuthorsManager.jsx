"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { useAdminLocale } from "../../_components/AdminLocale";

// Auteurs et relecteurs des guides (vague 2B du référencement).

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";

const toForm = (a) => ({
  name: a?.name || "",
  nameAr: a?.name_ar || "",
  jobTitleFr: a?.job_title_fr || "",
  jobTitleAr: a?.job_title_ar || "",
  bioFr: a?.bio_fr || "",
  bioAr: a?.bio_ar || "",
  photoUrl: a?.photo_url || "",
  tripsSupervised: a?.trips_supervised ?? "",
  isReligiousReferent: Boolean(a?.is_religious_referent),
  staffUserId: a?.staff_user_id ? String(a.staff_user_id) : "",
  isActive: a ? Boolean(a.is_active) : true,
});

function AuthorForm({ initial, staff, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "authors");
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi");
      setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

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
          <label className="block text-sm font-medium text-zinc-700">Nom</label>
          <input required value={form.name} onChange={set("name")} dir="auto" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom en arabe (facultatif)</label>
          <input value={form.nameAr} onChange={set("nameAr")} dir="rtl" lang="ar" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Fonction (français)</label>
          <input value={form.jobTitleFr} onChange={set("jobTitleFr")} dir="ltr" placeholder="ex. Guide religieux" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Fonction (arabe)</label>
          <input value={form.jobTitleAr} onChange={set("jobTitleAr")} dir="rtl" lang="ar" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Présentation (français)</label>
          <textarea value={form.bioFr} onChange={set("bioFr")} rows={3} dir="ltr" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Présentation (arabe)</label>
          <textarea value={form.bioAr} onChange={set("bioAr")} rows={3} dir="rtl" lang="ar" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Voyages encadrés</label>
          <input type="number" min="0" value={form.tripsSupervised} onChange={set("tripsSupervised")} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Compte de l&apos;équipe (facultatif)</label>
          <select value={form.staffUserId} onChange={set("staffUserId")} className={input}>
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Photo</label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {form.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={handlePhoto} className="text-sm" />
          {form.photoUrl && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))} className="text-xs text-red-600 hover:underline">
              Retirer la photo
            </button>
          )}
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={form.isReligiousReferent} onChange={set("isReligiousReferent")} className="mt-1" />
        <span>Référent religieux (peut relire et valider un guide religieux)</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={form.isActive} onChange={set("isActive")} className="mt-1" />
        <span>Actif (proposé dans les guides)</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || uploading} className="gf-btn-primary">
          Enregistrer
        </button>
        <button type="button" className="gf-btn-outline" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function AuthorsManager({ initialAuthors, staff }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  const [authors, setAuthors] = useState(initialAuthors);
  const [editing, setEditing] = useState(null); // { id?, initial }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  async function send(url, method, body) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action impossible");
      setAuthors(data.authors);
      router.refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="gf-card overflow-hidden">
      <div className="gf-card-head gf-divided">
        <h2 className="gf-card-title">
          <Icon name="history_edu" size={18} />
          {tr("Auteurs ({count})", { count: authors.length })}
        </h2>
        <button type="button" className="gf-btn-primary" onClick={() => setEditing({ initial: null })}>
          <Icon name="add" size={16} />
          Nouvel auteur
        </button>
      </div>
      {error && !editing && <p className="mx-5 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {authors.length === 0 ? (
        <div className="gf-empty">Aucun auteur. Ajoutez au moins l&apos;auteur des guides et, pour les contenus religieux, un référent religieux.</div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {authors.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="flex min-w-0 gap-3">
                {a.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                    <Icon name="person" size={20} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900" translate="no" dir="auto">
                    {a.name}
                    {a.name_ar && <span className="ms-2 text-zinc-500">{a.name_ar}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {a.job_title_fr && <span translate="no">{a.job_title_fr}</span>}
                    {Boolean(a.is_religious_referent) && <span className="rounded-full bg-amber-100 px-2 text-amber-800">Référent religieux</span>}
                    {!a.is_active && <span className="rounded-full bg-zinc-100 px-2">Inactif</span>}
                    <span>{tr("Guides : {count}", { count: Number(a.guide_count) })}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="gf-btn-icon" aria-label="Modifier" onClick={() => setEditing({ id: a.id, initial: a })}>
                  <Icon name="edit" size={18} />
                </button>
                <button
                  type="button"
                  className="gf-btn-icon gf-danger"
                  aria-label="Supprimer"
                  onClick={async () => {
                    if (await confirm("Supprimer cet auteur ?")) send(`/api/admin/authors/${a.id}`, "DELETE");
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
        <Modal title={editing.id ? "Modifier l'auteur" : "Nouvel auteur"} onClose={() => setEditing(null)} size="lg">
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <AuthorForm
            initial={editing.initial}
            staff={staff}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (form) => {
              const ok = editing.id
                ? await send(`/api/admin/authors/${editing.id}`, "PUT", form)
                : await send("/api/admin/authors", "POST", form);
              if (ok) setEditing(null);
            }}
          />
        </Modal>
      )}
      {confirmDialog}
    </section>
  );
}
