"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";
import TranslationFields, { ContentLocaleSelect, otherContentLocale } from "@/app/admin/_components/TranslationFields";
import { GUIDE_PILLARS, GUIDE_PILLAR_LABELS } from "@/lib/editorial";

// Éditeur d'un guide (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies). Contenu en Markdown simple, langue principale +
// version dans l'autre langue (modèle de la vague 1B), auteur, relecteur,
// programmes dont la fiche affiche ce guide.

const TRANSLATION_FIELDS = [
  { key: "title", label: "Titre" },
  { key: "excerpt", label: "Résumé", multiline: true, rows: 3 },
  { key: "content", label: "Contenu (Markdown)", multiline: true, rows: 14 },
  { key: "metaTitle", label: "Titre pour Google (60 caractères max.)" },
  { key: "metaDescription", label: "Description pour Google (155 caractères max.)" },
];
const EMPTY_TRANSLATION = { title: "", excerpt: "", content: "", metaTitle: "", metaDescription: "" };
const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Counter({ value, max }) {
  const length = String(value || "").length;
  return <span className={`text-xs ${length > max ? "text-red-600" : "text-zinc-400"}`}>{`${length} / ${max}`}</span>;
}

export default function GuideForm({ guide, translations = {}, authors = [], programs = [] }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  const [confirm, confirmDialog] = useConfirm();
  const isEdit = Boolean(guide);

  const [form, setForm] = useState({
    title: guide?.title || "",
    slug: guide?.slug || "",
    pillar: guide?.pillar || "omra",
    excerpt: guide?.excerpt || "",
    content: guide?.content || "",
    coverImageUrl: guide?.cover_image_url || "",
    metaTitle: guide?.meta_title || "",
    metaDescription: guide?.meta_description || "",
    authorId: guide?.author_id ? String(guide.author_id) : "",
    reviewerId: guide?.reviewer_id ? String(guide.reviewer_id) : "",
    isReligious: Boolean(guide?.is_religious),
    reviewedAt: guide?.reviewed_at ? String(guide.reviewed_at).slice(0, 10) : "",
    status: guide?.status || "brouillon",
  });
  const [contentLocale, setContentLocale] = useState(guide?.content_locale || "ar");
  const [translation, setTranslation] = useState({
    ...EMPTY_TRANSLATION,
    ...(translations[otherContentLocale(guide?.content_locale || "ar")] || {}),
  });
  const [programIds, setProgramIds] = useState((guide?.program_ids || []).map(String));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const dir = contentLocale === "ar" ? "rtl" : "ltr";
  const reviewer = authors.find((a) => String(a.id) === form.reviewerId);
  const religiousBlocked = form.isReligious && form.status === "publie" && !reviewer?.is_religious_referent;

  // Changer de langue principale échange les deux versions.
  const handleContentLocaleChange = (next) => {
    if (next === contentLocale) return;
    const previous = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
    };
    setForm((f) => ({ ...f, ...translation }));
    setTranslation(previous);
    setContentLocale(next);
  };

  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "guides");
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi");
      setForm((f) => ({ ...f, coverImageUrl: data.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/admin/guides/${guide.id}` : "/api/admin/guides", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contentLocale,
          translations: { [otherContentLocale(contentLocale)]: translation },
          programIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'enregistrement");
      router.push("/admin/contenus/guides");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm("Supprimer ce guide ?"))) return;
    const res = await fetch(`/api/admin/guides/${guide.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/contenus/guides");
      router.refresh();
    } else {
      setError("Erreur lors de la suppression");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl space-y-5 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Titre</label>
            <input required value={form.title} onChange={set("title")} dir={dir} className={input} />
          </div>
          <ContentLocaleSelect value={contentLocale} onChange={handleContentLocaleChange} />
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Slug (adresse /guide/...) — vide = créé depuis le titre</label>
            <input value={form.slug} onChange={set("slug")} dir="ltr" className={input} placeholder="ex. documents-omra" />
            <p className="mt-1 text-xs text-zinc-500">Lettres latines, chiffres et tirets. Changer le slug d&apos;un guide publié crée une redirection automatique.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Résumé (affiché en tête et sur les cartes)</label>
          <textarea value={form.excerpt} onChange={set("excerpt")} rows={3} dir={dir} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Contenu (Markdown)</label>
          <textarea value={form.content} onChange={set("content")} rows={18} dir={dir} className={`${input} font-mono`} />
          <p className="mt-1 text-xs text-zinc-500">
            Titres (## Titre), listes (- élément), gras (**texte**), liens ([texte](/omra)). Visez au moins 300 mots, avec des intertitres en forme de question.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Image de couverture</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {form.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImageUrl} alt="" className="h-16 w-28 rounded object-cover" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={handleCover} className="text-sm" />
            {form.coverImageUrl && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, coverImageUrl: "" }))} className="text-xs text-red-600 hover:underline">
                Retirer l&apos;image
              </button>
            )}
          </div>
          {uploading && <p className="mt-1 text-xs text-zinc-500">Envoi en cours...</p>}
        </div>

        <fieldset className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium text-zinc-700">Auteur et relecture</legend>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Auteur</label>
            <select value={form.authorId} onChange={set("authorId")} className={input}>
              <option value="">—</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Relecteur</label>
            <select value={form.reviewerId} onChange={set("reviewerId")} className={input}>
              <option value="">—</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.is_religious_referent ? tr("{name} (référent religieux)", { name: a.name }) : a.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-zinc-700 sm:col-span-2">
            <input type="checkbox" checked={form.isReligious} onChange={set("isReligious")} className="mt-1" />
            <span>Contenu religieux (rites, conditions de validité...) : publication seulement après relecture par un référent religieux</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Relu le</label>
            <div className="flex gap-2">
              <input type="date" value={form.reviewedAt} max={todayIso()} onChange={set("reviewedAt")} className={input} />
              <button type="button" onClick={() => setForm((f) => ({ ...f, reviewedAt: todayIso() }))} className="mt-1 shrink-0 rounded-lg border px-3 text-xs hover:bg-zinc-50">
                Marquer comme relu
              </button>
            </div>
          </div>
          {authors.length === 0 && (
            <p className="text-xs text-amber-700 sm:col-span-2">Aucun auteur : créez-les d&apos;abord dans Contenus → Auteurs.</p>
          )}
        </fieldset>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Programmes dont la fiche affiche ce guide (« Guides utiles »)</label>
          <select
            multiple
            value={programIds}
            onChange={(e) => setProgramIds([...e.target.selectedOptions].map((o) => o.value))}
            className={`${input} h-40`}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Ctrl / Cmd + clic pour en choisir plusieurs. Sans choix, une fiche affiche les guides les plus récents de son pilier.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex justify-between text-sm font-medium text-zinc-700">
              <span>Titre pour Google</span>
              <Counter value={form.metaTitle} max={60} />
            </label>
            <input value={form.metaTitle} onChange={set("metaTitle")} dir={dir} className={input} />
          </div>
          <div>
            <label className="flex justify-between text-sm font-medium text-zinc-700">
              <span>Description pour Google</span>
              <Counter value={form.metaDescription} max={155} />
            </label>
            <input value={form.metaDescription} onChange={set("metaDescription")} dir={dir} className={input} />
          </div>
        </div>

        <TranslationFields locale={otherContentLocale(contentLocale)} fields={TRANSLATION_FIELDS} values={translation} onChange={setTranslation} />

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select value={form.status} onChange={set("status")} className={input}>
            <option value="brouillon">Brouillon</option>
            <option value="publie">Publié</option>
          </select>
        </div>
        {religiousBlocked && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Un guide religieux ne peut être publié qu&apos;avec un relecteur référent religieux.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          <button type="submit" disabled={submitting || uploading || religiousBlocked} className="gf-btn-primary disabled:opacity-60">
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </button>
          {isEdit && (
            <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:underline">
              Supprimer ce guide
            </button>
          )}
        </div>
      </form>
      {confirmDialog}
    </>
  );
}
