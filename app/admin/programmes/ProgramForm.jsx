"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];
const SEASONS = ["mawlid", "rajab", "chaabane", "ramadan", "chawal"];

export default function ProgramForm({ program, canDelete }) {
  const router = useRouter();
  const isEdit = !!program;

  const [title, setTitle] = useState(program?.title || "");
  const [slug, setSlug] = useState(program?.slug || "");
  const [programType, setProgramType] = useState(program?.program_type || "omra");
  const [family, setFamily] = useState(program?.family || "omra_hajj");
  const [season, setSeason] = useState(program?.season || "");
  const [theme, setTheme] = useState(program?.theme || "");
  const [shortDescription, setShortDescription] = useState(
    program?.short_description || ""
  );
  const [fullDescription, setFullDescription] = useState(
    program?.full_description || ""
  );
  const [coverImageUrl, setCoverImageUrl] = useState(program?.cover_image_url || "");
  const [isPublished, setIsPublished] = useState(!!program?.is_published);
  const [metaTitle, setMetaTitle] = useState(program?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(
    program?.meta_description || ""
  );
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      slug,
      programType,
      family,
      season: family === "omra_hajj" ? season || null : null,
      theme: family === "voyage_organise" ? theme || null : null,
      shortDescription: shortDescription || null,
      fullDescription: fullDescription || null,
      coverImageUrl: coverImageUrl || null,
      isPublished,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    };

    try {
      const url = isEdit ? `/api/admin/programs/${program.id}` : "/api/admin/programs";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }

      router.push("/admin/programmes");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce programme ?")) return;
    const res = await fetch(`/api/admin/programs/${program.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message);
      return;
    }
    router.push("/admin/programmes");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Titre</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Slug (URL) — vide = généré depuis le titre
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="omra-ramadan-premium"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Type</label>
          <select
            value={programType}
            onChange={(e) => setProgramType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {PROGRAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Famille (catalogue public)
          </label>
          <select
            required
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Détermine le hub public (/omra-hajj ou /voyages-organises).
          </p>
        </div>

        {family === "omra_hajj" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Saison (calendrier hégirien)
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— Non précisée —</option>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {family === "voyage_organise" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Thème / envie
            </label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="plage, culture, aventure, famille, couple..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Description courte
        </label>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Description complète
        </label>
        <textarea
          value={fullDescription}
          onChange={(e) => setFullDescription(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          URL image de couverture
        </label>
        <input
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Meta title (SEO)
          </label>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Meta description (SEO)
          </label>
          <input
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Publié (visible sur le site public)
      </label>

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
            Supprimer ce programme
          </button>
        )}
      </div>
    </form>
  );
}
