"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisplayCard({ program, canManage }) {
  const router = useRouter();

  const [slug, setSlug] = useState(program.slug || "");
  const [shortDescription, setShortDescription] = useState(program.short_description || "");
  const [fullDescription, setFullDescription] = useState(program.full_description || "");
  const [coverImageUrl, setCoverImageUrl] = useState(program.cover_image_url || "");
  const [metaTitle, setMetaTitle] = useState(program.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(program.meta_description || "");
  const [isPublished, setIsPublished] = useState(!!program.is_published);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'envoi de l'image");
      }

      setCoverImageUrl(data.url);
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
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          shortDescription: shortDescription || null,
          fullDescription: fullDescription || null,
          coverImageUrl: coverImageUrl || null,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          isPublished,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
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
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Affichage</h2>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Slug (URL) — vide = généré depuis le titre
        </label>
        <input
          disabled={!canManage}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="omra-ramadan-premium"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Description courte</label>
        <textarea
          disabled={!canManage}
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Description complète</label>
        <textarea
          disabled={!canManage}
          value={fullDescription}
          onChange={(e) => setFullDescription(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Image de couverture</label>

        {coverImageUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt=""
              className="h-24 w-36 rounded-lg border border-zinc-200 object-cover"
            />
            {canManage && (
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
                className="text-sm text-red-600 hover:underline"
              >
                Supprimer l&apos;image
              </button>
            )}
          </div>
        )}

        {canManage && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading}
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
          />
        )}
        {uploading && <p className="mt-1 text-sm text-zinc-500">Envoi en cours...</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Meta title (SEO)</label>
          <input
            disabled={!canManage}
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Meta description (SEO)
          </label>
          <input
            disabled={!canManage}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          type="checkbox"
          disabled={!canManage}
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Publié (visible sur le site public)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
