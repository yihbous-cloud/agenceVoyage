"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

const CUSTOM_LINK_VALUE = "custom";

function emptyForm() {
  return {
    title: "",
    subtitle: "",
    imageUrl: "",
    buttonText: "Découvrir",
    programId: "",
    buttonLink: "",
    isActive: true,
  };
}

function toFormState(slide) {
  return {
    title: slide.title,
    subtitle: slide.subtitle || "",
    imageUrl: slide.image_url || "",
    buttonText: slide.button_text || "Découvrir",
    programId: slide.program_id ? String(slide.program_id) : "",
    buttonLink: slide.program_id ? "" : slide.button_link || "",
    isActive: !!slide.is_active,
  };
}

function SlideForm({ initial, programs, onCancel, onSaved, submitLabel }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const linkMode = form.programId ? form.programId : CUSTOM_LINK_VALUE;

  const set = (key) => (e) => {
    const value = key === "isActive" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleLinkModeChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, programId: value === CUSTOM_LINK_VALUE ? "" : value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "slider");
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi de l'image");
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSaved(form);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="col-span-2">
        <label className="block text-sm font-medium text-zinc-700">Image de fond</label>
        {form.imageUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.imageUrl}
              alt=""
              className="h-20 w-36 rounded-lg border border-zinc-200 object-cover"
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
              className="text-sm text-red-600 hover:underline"
            >
              Supprimer l&apos;image
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={uploading}
          className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
        />
        {uploading && <p className="mt-1 text-sm text-zinc-500">Envoi en cours...</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <p className="mt-1 text-xs text-zinc-500">
          JPG, PNG, WEBP ou GIF — 5 Mo maximum. Sans image, un fond dégradé
          doré/sombre est utilisé par défaut.
        </p>
      </div>

      <div className="col-span-2">
        <label className="block text-sm font-medium text-zinc-700">Titre</label>
        <input
          required
          value={form.title}
          onChange={set("title")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-zinc-700">Sous-titre</label>
        <input
          value={form.subtitle}
          onChange={set("subtitle")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Lien vers</label>
        <select
          value={linkMode}
          onChange={handleLinkModeChange}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value={CUSTOM_LINK_VALUE}>— Lien personnalisé —</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-400">
          Programme choisi : le lien reste correct même si son slug change.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          {linkMode === CUSTOM_LINK_VALUE ? "URL personnalisée" : "Texte du bouton"}
        </label>
        {linkMode === CUSTOM_LINK_VALUE ? (
          <input
            required={linkMode === CUSTOM_LINK_VALUE}
            value={form.buttonLink}
            onChange={set("buttonLink")}
            placeholder="/omra-hajj, https://..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        ) : (
          <input
            value={form.buttonText}
            onChange={set("buttonText")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        )}
      </div>

      {linkMode !== CUSTOM_LINK_VALUE && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Texte du bouton</label>
          <input
            value={form.buttonText}
            onChange={set("buttonText")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={set("isActive")}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Diapositive active
        </label>
      </div>

      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

      <div className="col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function SlidesManager({ initialSlides, programs }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (form) => {
    const res = await fetch("/api/admin/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, programId: form.programId || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Erreur lors de la création");
    }
    setShowCreate(false);
  };

  const handleUpdate = (id) => async (form) => {
    const res = await fetch(`/api/admin/slides/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, programId: form.programId || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Erreur lors de la mise à jour");
    }
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette diapositive ?")) return;
    const res = await fetch(`/api/admin/slides/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }
    router.refresh();
  };

  const handleMove = async (id, direction) => {
    const res = await fetch(`/api/admin/slides/${id}/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }
    router.refresh();
  };

  const handleToggleActive = async (slide) => {
    const res = await fetch(`/api/admin/slides/${slide.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: slide.title,
        subtitle: slide.subtitle,
        imageUrl: slide.image_url,
        buttonText: slide.button_text,
        programId: slide.program_id,
        buttonLink: slide.button_link,
        isActive: !slide.is_active,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Ordre</th>
              <th className="px-4 py-3">Aperçu</th>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Lien</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {initialSlides.map((s, index) => (
              <Fragment key={s.id}>
                <tr className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(s.id, "up")}
                        className="text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                        title="Monter"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === initialSlides.length - 1}
                        onClick={() => handleMove(s.id, "down")}
                        className="text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                        title="Descendre"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt=""
                        className="h-12 w-20 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-20 rounded bg-gradient-to-br from-zinc-800 via-zinc-700 to-amber-700/40" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.title}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {s.program_title ? `Programme : ${s.program_title}` : s.href}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        s.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                      className="text-emerald-700 hover:underline"
                    >
                      {editingId === s.id ? "Fermer" : "Modifier"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="ml-3 text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
                {editingId === s.id && (
                  <tr>
                    <td colSpan={6} className="bg-zinc-50 px-4 py-4">
                      <SlideForm
                        initial={toFormState(s)}
                        programs={programs}
                        onCancel={() => setEditingId(null)}
                        onSaved={handleUpdate(s.id)}
                        submitLabel="Enregistrer"
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {initialSlides.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                  Aucune diapositive.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <SlideForm
          initial={emptyForm()}
          programs={programs}
          onCancel={() => setShowCreate(false)}
          onSaved={handleCreate}
          submitLabel="Créer la diapositive"
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Nouvelle diapositive
        </button>
      )}
    </div>
  );
}
