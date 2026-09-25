"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POPULAR_DESTINATION_COUNTRIES } from "@/lib/worldPlaces";

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];
const TRIP_STATUSES = ["planifie", "ouvert", "complet", "en_cours", "termine", "annule"];

export default function ProgramForm({
  program,
  hotels = [],
  airlines = [],
  defaultHotelIds = [],
  canDelete,
}) {
  const router = useRouter();
  const isEdit = !!program;

  const [title, setTitle] = useState(program?.title || "");
  const [slug, setSlug] = useState(program?.slug || "");
  const [programType, setProgramType] = useState(program?.program_type || "omra");
  const [family, setFamily] = useState(program?.family || "omra_hajj");
  // Champ Saison retiré du formulaire (voir CLAUDE.md) — une valeur déjà
  // enregistrée sur un programme existant est préservée telle quelle à
  // l'édition (state en lecture seule, jamais réécrite depuis l'UI).
  const [season] = useState(program?.season || "");
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
  const [selectedHotelIds, setSelectedHotelIds] = useState(
    defaultHotelIds.map((id) => String(id))
  );

  // Premier voyage, saisi en parallèle uniquement à la création du programme
  // (voir CLAUDE.md) — un programme reste libre d'avoir d'autres voyages à
  // des dates différentes ensuite, ajoutés depuis sa fiche.
  const [tripReferenceCode, setTripReferenceCode] = useState("");
  const [tripReferenceTouched, setTripReferenceTouched] = useState(false);
  const [tripStatus, setTripStatus] = useState("planifie");
  const [tripDepartureDate, setTripDepartureDate] = useState("");
  const [tripReturnDate, setTripReturnDate] = useState("");
  const [tripDestinationCountry, setTripDestinationCountry] = useState("Arabie Saoudite");
  const [tripAirlineId, setTripAirlineId] = useState("");
  const [tripOriginIata, setTripOriginIata] = useState("");
  const [tripDestinationIata, setTripDestinationIata] = useState("");
  const [tripReturnOriginIata, setTripReturnOriginIata] = useState("");
  const [tripReturnDestinationIata, setTripReturnDestinationIata] = useState("");
  const [tripHasOutboundLayover, setTripHasOutboundLayover] = useState(false);
  const [tripOutboundLayoverIata, setTripOutboundLayoverIata] = useState("");
  const [tripHasReturnLayover, setTripHasReturnLayover] = useState(false);
  const [tripReturnLayoverIata, setTripReturnLayoverIata] = useState("");
  const [tripTotalSeats, setTripTotalSeats] = useState(0);
  const [tripPriceDouble, setTripPriceDouble] = useState(0);
  const [tripPriceTriple, setTripPriceTriple] = useState(0);
  const [tripPriceQuadruple, setTripPriceQuadruple] = useState(0);
  const [tripPriceQuintuple, setTripPriceQuintuple] = useState(0);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [createdProgramId, setCreatedProgramId] = useState(null);

  // Référence du premier voyage alignée sur le titre du programme tant que
  // le personnel ne l'a pas modifiée à la main (même logique que la
  // génération du slug côté serveur, mais ici visible en direct).
  useEffect(() => {
    if (!isEdit && !tripReferenceTouched) {
      setTripReferenceCode(title);
    }
  }, [title, isEdit, tripReferenceTouched]);

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
      defaultHotelIds: selectedHotelIds.map((id) => Number(id)),
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

      if (isEdit) {
        router.push("/admin/programmes");
        router.refresh();
        return;
      }

      const { id: programId } = await res.json();

      const tripPayload = {
        referenceCode: tripReferenceCode,
        departureDate: tripDepartureDate,
        returnDate: tripReturnDate,
        destinationCountry: tripDestinationCountry,
        originIata: tripOriginIata || null,
        destinationIata: tripDestinationIata || null,
        returnOriginIata: tripReturnOriginIata || null,
        returnDestinationIata: tripReturnDestinationIata || null,
        outboundLayoverIata: tripHasOutboundLayover ? tripOutboundLayoverIata || null : null,
        returnLayoverIata: tripHasReturnLayover ? tripReturnLayoverIata || null : null,
        airlineId: tripAirlineId || null,
        totalSeats: Number(tripTotalSeats),
        priceDouble: Number(tripPriceDouble),
        priceTriple: Number(tripPriceTriple),
        priceQuadruple: Number(tripPriceQuadruple),
        priceQuintuple: Number(tripPriceQuintuple),
        status: tripStatus,
        notes: null,
      };

      const tripRes = await fetch(`/api/admin/programs/${programId}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripPayload),
      });

      if (!tripRes.ok) {
        const tripData = await tripRes.json();
        // Le programme est déjà créé à ce stade : on ne bloque pas dessus,
        // on laisse le personnel ajouter le voyage manuellement depuis sa fiche.
        setCreatedProgramId(programId);
        throw new Error(
          `Programme créé, mais le voyage n'a pas pu l'être : ${
            tripData.message || "erreur serveur"
          }. Ajoutez-le depuis la fiche du programme.`
        );
      }

      const tripData = await tripRes.json();
      router.push(`/admin/voyages/${tripData.id}/hebergement`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHotelsSelectChange = (e) => {
    setSelectedHotelIds(Array.from(e.target.selectedOptions, (o) => o.value));
  };

  const hotelsByCity = [];
  const seenCities = new Map();
  for (const h of hotels) {
    if (!seenCities.has(h.city)) {
      seenCities.set(h.city, { city: h.city, items: [] });
      hotelsByCity.push(seenCities.get(h.city));
    }
    seenCities.get(h.city).items.push(h);
  }

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
      </div>

      {family === "voyage_organise" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Thème / envie</label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="plage, culture, aventure, famille, couple..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Hôtels habituels de ce programme
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Fixés une fois ici : chaque nouveau voyage créé sous ce programme les récupère
          automatiquement (dates pré-remplies sur toute la durée du voyage, ajustables ensuite
          depuis sa page hébergement).
        </p>
        {hotelsByCity.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucun hôtel au catalogue — ajoutez-en d&apos;abord depuis{" "}
            <a href="/admin/hotels" className="text-emerald-700 hover:underline">
              /admin/hotels
            </a>
            .
          </p>
        ) : (
          <>
            <select
              multiple
              value={selectedHotelIds}
              onChange={handleHotelsSelectChange}
              className="mt-2 h-48 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {hotelsByCity.map((group) => (
                <optgroup key={group.city} label={group.city}>
                  {group.items.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400">
              Ctrl/Cmd + clic (ou glisser) pour sélectionner plusieurs hôtels.
            </p>
          </>
        )}
      </div>

      {!isEdit && (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Premier voyage</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Un programme peut avoir plusieurs voyages à des dates différentes — ce premier
              voyage est créé en parallèle du programme pour aller plus vite ; les suivants
              s&apos;ajoutent ensuite depuis la fiche du programme.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Référence (ex: GF-OMR-2027-03)
              </label>
              <input
                required
                value={tripReferenceCode}
                onChange={(e) => {
                  setTripReferenceCode(e.target.value);
                  setTripReferenceTouched(true);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Pré-remplie depuis le titre du programme, modifiable.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Statut</label>
              <select
                value={tripStatus}
                onChange={(e) => setTripStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
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
                value={tripDepartureDate}
                onChange={(e) => setTripDepartureDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date de retour</label>
              <input
                type="date"
                required
                value={tripReturnDate}
                onChange={(e) => setTripReturnDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Pays de destination
              </label>
              <input
                list="trip-destination-countries"
                value={tripDestinationCountry}
                onChange={(e) => setTripDestinationCountry(e.target.value)}
                placeholder="Taper pour rechercher..."
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <datalist id="trip-destination-countries">
                {POPULAR_DESTINATION_COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Compagnie aérienne
              </label>
              <select
                value={tripAirlineId}
                onChange={(e) => setTripAirlineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {airlines.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Aéroport de départ — aller (IATA)
              </label>
              <input
                maxLength={3}
                value={tripOriginIata}
                onChange={(e) => setTripOriginIata(e.target.value.toUpperCase())}
                placeholder="ex: CMN"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Aéroport d&apos;arrivée — aller (IATA)
              </label>
              <input
                maxLength={3}
                value={tripDestinationIata}
                onChange={(e) => setTripDestinationIata(e.target.value.toUpperCase())}
                placeholder="ex: JED"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Aéroport de départ — retour (IATA, optionnel)
              </label>
              <input
                maxLength={3}
                value={tripReturnOriginIata}
                onChange={(e) => setTripReturnOriginIata(e.target.value.toUpperCase())}
                placeholder="Vide = arrivée aller inversée"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase placeholder:normal-case"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Aéroport d&apos;arrivée — retour (IATA, optionnel)
              </label>
              <input
                maxLength={3}
                value={tripReturnDestinationIata}
                onChange={(e) => setTripReturnDestinationIata(e.target.value.toUpperCase())}
                placeholder="Vide = départ aller inversé"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase placeholder:normal-case"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-zinc-500">
            Codes IATA à 3 lettres. Aéroports du retour laissés vides = mêmes aéroports que
            l&apos;aller, sens inversé (cas le plus courant).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={tripHasOutboundLayover}
                  onChange={(e) => {
                    setTripHasOutboundLayover(e.target.checked);
                    if (!e.target.checked) setTripOutboundLayoverIata("");
                  }}
                />
                Voyage avec escale (Aller)
              </label>
              {tripHasOutboundLayover && (
                <input
                  maxLength={3}
                  value={tripOutboundLayoverIata}
                  onChange={(e) => setTripOutboundLayoverIata(e.target.value.toUpperCase())}
                  placeholder="ex: IST"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
                />
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={tripHasReturnLayover}
                  onChange={(e) => {
                    setTripHasReturnLayover(e.target.checked);
                    if (!e.target.checked) setTripReturnLayoverIata("");
                  }}
                />
                Voyage avec escale (Retour)
              </label>
              {tripHasReturnLayover && (
                <input
                  maxLength={3}
                  value={tripReturnLayoverIata}
                  onChange={(e) => setTripReturnLayoverIata(e.target.value.toUpperCase())}
                  placeholder="ex: IST"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Places totales</label>
            <input
              type="number"
              min="0"
              value={tripTotalSeats}
              onChange={(e) => setTripTotalSeats(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700">
              Prix par personne, par type de chambre
            </p>
            <div className="mt-1 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500">Chambre double / binôme</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={tripPriceDouble}
                  onChange={(e) => setTripPriceDouble(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500">Chambre triple</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={tripPriceTriple}
                  onChange={(e) => setTripPriceTriple(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500">Chambre quadruple</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={tripPriceQuadruple}
                  onChange={(e) => setTripPriceQuadruple(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500">
                  Chambre quintuple — prix affiché au public
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={tripPriceQuintuple}
                  onChange={(e) => setTripPriceQuintuple(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Le prix affiché publiquement est toujours le plus bas des quatre (généralement le
              prix quintuple).
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Affichage public (site)</h2>

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
            Image de couverture
          </label>

          {coverImageUrl && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageUrl}
                alt=""
                className="h-24 w-36 rounded-lg border border-zinc-200 object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
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
            JPG, PNG, WEBP ou GIF — 5 Mo maximum.
          </p>
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
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
          {createdProgramId && (
            <>
              {" "}
              <a
                href={`/admin/programmes/${createdProgramId}`}
                className="underline hover:no-underline"
              >
                Voir le programme
              </a>
            </>
          )}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={submitting || uploading || !!createdProgramId}
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
