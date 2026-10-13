"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import TranslationFields, { ContentLocaleSelect, otherContentLocale } from "@/app/admin/_components/TranslationFields";

// Champs de contenu traduisibles (vague 1B, lib/contentTranslations.js).
const PROGRAM_TRANSLATION_FIELDS = [
  { key: "title", label: "Titre" },
  { key: "shortDescription", label: "Description courte", multiline: true, rows: 2 },
  { key: "fullDescription", label: "Description complète", multiline: true, rows: 6 },
  { key: "metaTitle", label: "Meta title (SEO)" },
  { key: "metaDescription", label: "Meta description (SEO)" },
];
const EMPTY_TRANSLATION = { title: "", shortDescription: "", fullDescription: "", metaTitle: "", metaDescription: "" };

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];
const TRIP_STATUSES = ["planifie", "ouvert", "complet", "en_cours", "termine", "annule"];

// canAdminDiscount / discountCap : plafond de réduction par voyageur
// (migration 042), rattaché aux informations du programme (son voyage
// principal) et visible/modifiable par l'administrateur seulement — jamais
// transmis à un autre rôle (voir page.js).
export default function InfoCard({ program, trip, translations = {}, successorOptions = [], hasTierPrices = false, canManage, canAdminDiscount = false, discountCap = null, onSuccess }) {
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
  const [cap, setCap] = useState(discountCap ?? "");

  // Affichage public (site) — regroupé ici au bas de la carte Informations
  // (fusion de l'ancienne carte "Affichage").
  const [slug, setSlug] = useState(program.slug || "");
  const [shortDescription, setShortDescription] = useState(program.short_description || "");
  const [fullDescription, setFullDescription] = useState(program.full_description || "");
  const [coverImageUrl, setCoverImageUrl] = useState(program.cover_image_url || "");
  const [metaTitle, setMetaTitle] = useState(program.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(program.meta_description || "");
  const [isPublished, setIsPublished] = useState(!!program.is_published);
  const [successorProgramId, setSuccessorProgramId] = useState(program.successor_program_id || "");
  // Langue principale des champs de contenu ci-dessus et version dans l'autre
  // langue (program_translations).
  const [contentLocale, setContentLocale] = useState(program.content_locale || "ar");
  const [translation, setTranslation] = useState({
    ...EMPTY_TRANSLATION,
    ...(translations[otherContentLocale(program.content_locale || "ar")] || {}),
  });

  // Changer de langue principale échange les deux versions : le texte saisi
  // reste rattaché à sa vraie langue.
  const handleContentLocaleChange = (next) => {
    if (next === contentLocale) return;
    const previousBase = { title, shortDescription, fullDescription, metaTitle, metaDescription };
    setTitle(translation.title);
    setShortDescription(translation.shortDescription);
    setFullDescription(translation.fullDescription);
    setMetaTitle(translation.metaTitle);
    setMetaDescription(translation.metaDescription);
    setTranslation(previousBase);
    setContentLocale(next);
  };
  const translationComplete =
    translation.title.trim() && (translation.shortDescription.trim() || translation.fullDescription.trim());

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Éléments manquants d'une fiche publiée (avertissement sous « Publié »).
  // Prix : l'un des 4 paliers du voyage principal, ou un tarif d'hébergement.
  const hasTripPrice = ["price_double", "price_triple", "price_quadruple", "price_quintuple"].some(
    (field) => Number(trip?.[field]) > 0
  );
  const publishWarnings = [
    !hasTripPrice && !hasTierPrices && "aucun prix (affiché « Prix sur demande »)",
    !shortDescription.trim() && !fullDescription.trim() && "aucune description",
    !coverImageUrl && "aucune image de couverture",
    !translationComplete &&
      (contentLocale === "ar" ? "version française incomplète (titre et description)" : "version arabe incomplète (titre et description)"),
  ].filter(Boolean);

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
          successorProgramId: successorProgramId || null,
          contentLocale,
          translations: { [otherContentLocale(contentLocale)]: translation },
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
            // Envoyé seulement par l'administrateur : la route le refuse sinon.
            ...(canAdminDiscount ? { discountCap: cap === "" ? null : Number(cap) } : {}),
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
          dir={contentLocale === "ar" ? "rtl" : "ltr"}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <ContentLocaleSelect value={contentLocale} onChange={handleContentLocaleChange} disabled={!canManage} />

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

          {canAdminDiscount && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="block text-sm font-medium text-zinc-700">
                Plafond de réduction par voyageur (MAD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-zinc-600">
                Visible par l&apos;administrateur seulement. L&apos;équipe peut accorder une réduction jusqu&apos;à ce
                montant ; au-delà, et pour toute gratuité, l&apos;accord de l&apos;administrateur est obligatoire. Vide =
                réductions réservées à l&apos;administrateur.
              </p>
            </div>
          )}
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
              className="mt-2 block w-full text-sm text-zinc-600 file:me-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
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

        <TranslationFields
          locale={otherContentLocale(contentLocale)}
          fields={PROGRAM_TRANSLATION_FIELDS}
          values={translation}
          onChange={setTranslation}
          disabled={!canManage}
        />

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Publié (visible sur le site public)
        </label>

        {/* TECH-09 (CLAUDE.md §3centquatorzequadragies) : quand tous les
            départs de ce programme sont passés, sa fiche reste en ligne et
            renvoie vers ce programme (« Prochaine édition »). */}
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Programme qui prend la suite
          </label>
          <select
            disabled={!canManage}
            value={successorProgramId}
            onChange={(e) => setSuccessorProgramId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            <option value="">Aucun (suggestions automatiques)</option>
            {successorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
                {option.is_published ? "" : " (non publié)"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Affiché sur la fiche publique quand tous les départs de ce programme sont terminés.
          </p>
        </div>

        {/* Référencement (CLAUDE.md §3centtreizequadragies) : une fiche publiée
            sans prix ni description est une page vide pour Google et les
            assistants IA. Simple avertissement, rien n'est bloqué. */}
        {isPublished && publishWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Fiche publiée mais incomplète :</p>
            <ul className="mt-1 list-disc ps-5">
              {publishWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
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
