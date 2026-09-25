"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POPULAR_DESTINATION_COUNTRIES, getCitiesForCountry } from "@/lib/worldPlaces";
import { AIRPORTS } from "@/lib/airports";

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];

// Formulaire de création uniquement — volontairement minimal (voir
// CLAUDE.md) : le reste (aéroports précis, hôtels, tarification, affichage,
// restauration) se complète ensuite sur la page de gestion du programme,
// organisée en cartes.
export default function ProgramForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [programType, setProgramType] = useState("omra");
  const [family, setFamily] = useState("omra_hajj");
  const [theme, setTheme] = useState("");

  const [tripDepartureDate, setTripDepartureDate] = useState("");
  const [tripReturnDate, setTripReturnDate] = useState("");
  const [tripOriginIata, setTripOriginIata] = useState("");
  const [tripDestinationCountry, setTripDestinationCountry] = useState("Arabie Saoudite");
  const [tripDestinationCity, setTripDestinationCity] = useState("");

  // Référence et statut du premier voyage : pas de champ visible, mais
  // toujours envoyés — la référence s'aligne sur le titre tant qu'elle n'a
  // jamais été modifiée ailleurs (ici elle ne l'est jamais, donc toujours
  // synchronisée à la création), éditable ensuite via la carte Informations.
  const [tripReferenceCode, setTripReferenceCode] = useState("");
  useEffect(() => {
    setTripReferenceCode(title);
  }, [title]);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState(null);

  const cityOptions = getCitiesForCountry(tripDestinationCountry);

  const handleDestinationCountryChange = (e) => {
    setTripDestinationCountry(e.target.value);
    setTripDestinationCity("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      programType,
      family,
      theme: family === "voyage_organise" ? theme || null : null,
      isPublished: false,
    };

    try {
      const res = await fetch("/api/admin/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }

      const { id: programId } = await res.json();

      const tripPayload = {
        referenceCode: tripReferenceCode,
        departureDate: tripDepartureDate,
        returnDate: tripReturnDate,
        originIata: tripOriginIata || null,
        destinationCountry: tripDestinationCountry,
        destinationCity: tripDestinationCity || null,
        status: "planifie",
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

      router.push(`/admin/programmes/${programId}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Ville de départ (Maroc)
        </label>
        <select
          required
          value={tripOriginIata}
          onChange={(e) => setTripOriginIata(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Sélectionner...</option>
          {Object.entries(AIRPORTS).map(([iata, info]) => (
            <option key={iata} value={iata}>
              {info.city} ({iata})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Pays de destination
          </label>
          <input
            list="new-program-destination-countries"
            value={tripDestinationCountry}
            onChange={handleDestinationCountryChange}
            placeholder="Taper pour rechercher..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <datalist id="new-program-destination-countries">
            {POPULAR_DESTINATION_COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Ville de destination
          </label>
          <input
            list="new-program-destination-cities"
            value={tripDestinationCity}
            onChange={(e) => setTripDestinationCity(e.target.value)}
            placeholder="Taper pour rechercher..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <datalist id="new-program-destination-cities">
            {cityOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
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

      <button
        type="submit"
        disabled={submitting || !!createdProgramId}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
