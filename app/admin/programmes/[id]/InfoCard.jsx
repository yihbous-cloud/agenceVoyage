"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];
const TRIP_STATUSES = ["planifie", "ouvert", "complet", "en_cours", "termine", "annule"];

export default function InfoCard({ program, trip, canManage, onSuccess }) {
  const router = useRouter();

  const [title, setTitle] = useState(program.title || "");
  const [programType, setProgramType] = useState(program.program_type || "omra");
  const [family, setFamily] = useState(program.family || "omra_hajj");
  const [theme, setTheme] = useState(program.theme || "");

  const [referenceCode, setReferenceCode] = useState(trip?.reference_code || "");
  const [status, setStatus] = useState(trip?.status || "planifie");
  const [departureDate, setDepartureDate] = useState(trip?.departure_date || "");
  const [returnDate, setReturnDate] = useState(trip?.return_date || "");
  const [totalSeats, setTotalSeats] = useState(trip?.total_seats ?? 0);
  const [destinationCountry, setDestinationCountry] = useState(
    trip?.destination_country || "Arabie Saoudite"
  );
  const [destinationCity, setDestinationCity] = useState(trip?.destination_city || "");

  // Affichage public (site) — regroupé ici au bas de la carte Informations
  // (fusion de l'ancienne carte "Affichage").
  const [slug, setSlug] = useState(program.slug || "");
  const [shortDescription, setShortDescription] = useState(program.short_description || "");
  const [fullDescription, setFullDescription] = useState(program.full_description || "");
  const [coverImageUrl, setCoverImageUrl] = useState(program.cover_image_url || "");
  const [metaTitle, setMetaTitle] = useState(program.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(program.meta_description || "");
  const [isPublished, setIsPublished] = useState(!!program.is_published);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
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
      const programRes = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          programType,
          family,
          theme: family === "voyage_organise" ? theme || null : null,
          slug,
          shortDescription: shortDescription || null,
          fullDescription: fullDescription || null,
          coverImageUrl: coverImageUrl || null,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          isPublished,
        }),
      });
      if (!programRes.ok) {
        const data = await programRes.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement du programme");
      }

      if (trip) {
        const tripRes = await fetch(`/api/admin/trips/${trip.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceCode,
            status,
            departureDate,
            returnDate,
            totalSeats: Number(totalSeats),
            destinationCountry,
            destinationCity: destinationCity || null,
          }),
        });
        if (!tripRes.ok) {
          const data = await tripRes.json();
          throw new Error(data.message || "Erreur lors de l'enregistrement du voyage");
        }
      }

      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm("Supprimer ce programme ?"))) return;
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
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Titre</label>
        <input
          required
          disabled={!canManage}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Type</label>
          <select
            disabled={!canManage}
            value={programType}
            onChange={(e) => setProgramType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {PROGRAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Famille</label>
          <select
            required
            disabled={!canManage}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {family === "voyage_organise" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Thème / envie</label>
          <input
            disabled={!canManage}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      )}

      {trip ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Référence</label>
              <input
                required
                disabled={!canManage}
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Statut</label>
              <select
                disabled={!canManage}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              >
                {TRIP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date d&apos;aller</label>
              <input
                type="date"
                required
                disabled={!canManage}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date de retour</label>
              <input
                type="date"
                required
                disabled={!canManage}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Nombre de places</label>
              <input
                type="number"
                min="0"
                disabled={!canManage}
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Pays de destination
              </label>
              <input
                disabled={!canManage}
                value={destinationCountry}
                onChange={(e) => {
                  setDestinationCountry(e.target.value);
                  setDestinationCity("");
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Ville de destination
            </label>
            <input
              disabled={!canManage}
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Ce programme n&apos;a aucun voyage — les dates, le nombre de places et la destination se
          renseignent une fois un voyage créé (liste des voyages ci-dessous).
        </p>
      )}

      <div className="space-y-4 border-t border-zinc-100 pt-4">
        <p className="text-sm font-medium text-zinc-700">Affichage public (site)</p>

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
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer ce programme
          </button>
        </div>
      )}
    </form>
    {confirmDialog}
    </>
  );
}
