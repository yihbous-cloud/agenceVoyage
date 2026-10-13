"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

// Photos et vidéo de la fiche voyage — bloc « Preuves » (vague 2A,
// CLAUDE.md §3centdixseptquadragies). Photos RÉELLES envoyées par l'upload
// existant (dossier programs), vidéo = lien YouTube (date de mise en ligne
// exigée pour le balisage VideoObject). La légende sert aussi de texte
// alternatif de l'image sur le site.

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100";

function MediaItem({ item, index, count, canManage, onMove, onDelete, onSaved }) {
  const [captionFr, setCaptionFr] = useState(item.caption_fr || "");
  const [captionAr, setCaptionAr] = useState(item.caption_ar || "");
  const [uploadDate, setUploadDate] = useState(item.video_upload_date ? String(item.video_upload_date).slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty =
    captionFr !== (item.caption_fr || "") ||
    captionAr !== (item.caption_ar || "") ||
    uploadDate !== (item.video_upload_date ? String(item.video_upload_date).slice(0, 10) : "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/program-media/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionFr, captionAr, videoUploadDate: uploadDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      onSaved({ ...item, caption_fr: captionFr || null, caption_ar: captionAr || null, video_upload_date: uploadDate || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:flex-row">
      <div className="shrink-0">
        {item.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={captionFr || captionAr || ""} className="h-24 w-36 rounded object-cover" />
        ) : (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex h-24 w-36 items-center justify-center rounded bg-zinc-900 text-xs text-white">
            ▶ YouTube
          </a>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600">Légende (français)</label>
            <input disabled={!canManage} value={captionFr} onChange={(e) => setCaptionFr(e.target.value)} dir="ltr" lang="fr" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">Légende (arabe)</label>
            <input disabled={!canManage} value={captionAr} onChange={(e) => setCaptionAr(e.target.value)} dir="rtl" lang="ar" className={input} />
          </div>
        </div>
        {item.kind === "video" && (
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-zinc-600">Date de mise en ligne de la vidéo</label>
            <input type="date" disabled={!canManage} value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className={input} />
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {dirty && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded bg-emerald-700 px-3 py-1 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            )}
            <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} className="rounded border px-2 py-1 hover:bg-zinc-50 disabled:opacity-40" aria-label="Monter">
              ↑
            </button>
            <button type="button" disabled={index === count - 1} onClick={() => onMove(index, 1)} className="rounded border px-2 py-1 hover:bg-zinc-50 disabled:opacity-40" aria-label="Descendre">
              ↓
            </button>
            <button type="button" onClick={() => onDelete(item)} className="rounded border px-2 py-1 text-red-600 hover:bg-red-50">
              Supprimer
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function MediaCard({ programId, initialMedia = [], canManage }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [media, setMedia] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDate, setVideoDate] = useState("");
  const [error, setError] = useState(null);

  const hasVideo = media.some((m) => m.kind === "video");

  const addMedia = async (payload) => {
    const res = await fetch(`/api/admin/programs/${programId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Erreur lors de l'ajout");
    setMedia(data.media);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        body.append("folder", "programs");
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Erreur lors de l'envoi");
        await addMedia({ kind: "photo", url: data.url });
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await addMedia({ kind: "video", url: videoUrl, videoUploadDate: videoDate });
      setVideoUrl("");
      setVideoDate("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMove = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    [next[index], next[target]] = [next[target], next[index]];
    setMedia(next);
    const res = await fetch(`/api/admin/programs/${programId}/media`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((m) => m.id) }),
    });
    if (res.ok) {
      setMedia((await res.json()).media);
      router.refresh();
    } else {
      setError("Erreur lors du changement d'ordre");
    }
  };

  const handleDelete = async (item) => {
    if (!(await confirm(item.kind === "video" ? "Supprimer cette vidéo ?" : "Supprimer cette photo ?"))) return;
    const res = await fetch(`/api/admin/program-media/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setMedia((list) => list.filter((m) => m.id !== item.id));
      router.refresh();
    } else {
      setError("Erreur lors de la suppression");
    }
  };

  const handleSaved = (updated) => setMedia((list) => list.map((m) => (m.id === updated.id ? updated : m)));

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500">
        Photos réelles du voyage (hôtels, groupe, lieux visités) et une vidéo YouTube. La première photo apparaît en tête de la galerie ; la légende sert de description de l&apos;image pour les moteurs de recherche. Objectif : au moins 3 photos ou vidéo, et un avis client.
      </p>

      {media.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune photo ni vidéo pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {media.map((item, index) => (
            <MediaItem
              key={item.id}
              item={item}
              index={index}
              count={media.length}
              canManage={canManage}
              onMove={handleMove}
              onDelete={handleDelete}
              onSaved={handleSaved}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-4 border-t border-zinc-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Ajouter des photos</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={handleFiles}
              className="mt-1 block text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              JPG, PNG ou WEBP, 5 Mo maximum par photo.
            </p>
            {uploading && <p className="mt-1 text-sm text-zinc-500">Envoi en cours...</p>}
          </div>

          {!hasVideo && (
            <form onSubmit={handleAddVideo} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Lien de la vidéo YouTube</label>
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  dir="ltr"
                  className={input}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Mise en ligne le</label>
                <input type="date" value={videoDate} onChange={(e) => setVideoDate(e.target.value)} className={input} />
              </div>
              <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
                Ajouter la vidéo
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {confirmDialog}
    </div>
  );
}
