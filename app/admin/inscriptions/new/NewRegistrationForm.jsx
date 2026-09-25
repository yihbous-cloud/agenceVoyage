"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_TYPES, pickTripPrice } from "@/lib/roomTypes";
import TravelerFields from "./TravelerFields";

const emptyTraveler = () => ({
  fullName: "",
  fullNameArabic: "",
  gender: "homme",
  dateOfBirth: "",
  nationalId: "",
  passportNumber: "",
  passportExpiryDate: "",
  phoneWhatsapp: "",
  email: "",
  address: "",
});

const TRAVELER_COUNT_LABELS = {
  individuel: "Voyageur",
  binome: ["Premier voyageur", "Deuxième voyageur"],
};

export default function NewRegistrationForm({ trips }) {
  const router = useRouter();
  const [tripId, setTripId] = useState("");
  const [tripHotels, setTripHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [hotelsError, setHotelsError] = useState(null);

  // Type d'inscription : individuel (1 voyageur), binôme (exactement 2,
  // ex. un couple) ou groupe (1 à N, extensible via "+ Ajouter un
  // voyageur") — voir CLAUDE.md §3quindecies.
  const [inscriptionType, setInscriptionType] = useState("individuel");
  const [travelers, setTravelers] = useState([emptyTraveler()]);
  const [groupLabel, setGroupLabel] = useState("");
  const [allowMixedGenderRoom, setAllowMixedGenderRoom] = useState(false);

  // Un voyageur Omra passe par plusieurs villes (Mecque + Médine) : une
  // préférence d'hôtel par ville plutôt qu'une seule pour tout le voyage
  // (§3quattuorvicies) — { [ville]: hotelId }.
  const [hotelPreferencesByCity, setHotelPreferencesByCity] = useState({});
  const [preferredRoomType, setPreferredRoomType] = useState("");

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTrip = trips.find((t) => String(t.id) === String(tripId));

  const tripHotelsByCity = [];
  const seenCities = new Map();
  for (const th of tripHotels) {
    if (!seenCities.has(th.city)) {
      seenCities.set(th.city, { city: th.city, items: [] });
      tripHotelsByCity.push(seenCities.get(th.city));
    }
    seenCities.get(th.city).items.push(th);
  }

  const handleTripChange = async (e) => {
    const value = e.target.value;
    setTripId(value);
    setHotelPreferencesByCity({});
    setTripHotels([]);
    setHotelsError(null);
    if (!value) return;
    setHotelsLoading(true);
    try {
      const res = await fetch(`/api/admin/trips/${value}/hotels`);
      if (res.ok) {
        setTripHotels(await res.json());
      } else {
        setHotelsError("Impossible de charger les hôtels de ce voyage (erreur serveur).");
      }
    } catch {
      setHotelsError("Impossible de charger les hôtels de ce voyage (connexion).");
    } finally {
      setHotelsLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    setInscriptionType(type);
    if (type === "individuel") {
      setTravelers((prev) => [prev[0] || emptyTraveler()]);
    } else if (type === "binome") {
      setTravelers((prev) => [prev[0] || emptyTraveler(), prev[1] || emptyTraveler()]);
    }
    // "groupe" : on garde la liste actuelle telle quelle (au moins 1)
  };

  const updateTravelerAt = (index, updated) => {
    setTravelers((prev) => prev.map((t, i) => (i === index ? updated : t)));
  };

  const handleAddTraveler = () => setTravelers((prev) => [...prev, emptyTraveler()]);
  const handleRemoveTraveler = (index) =>
    setTravelers((prev) => prev.filter((_, i) => i !== index));

  const travelerLabel = (index) => {
    if (inscriptionType === "binome") return TRAVELER_COUNT_LABELS.binome[index];
    if (inscriptionType === "groupe") return `Voyageur ${index + 1}`;
    return "Voyageur";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let groupId = null;
      if (inscriptionType !== "individuel") {
        if (!groupLabel.trim()) {
          throw new Error("Le nom du groupe/binôme est requis");
        }
        const groupRes = await fetch(`/api/admin/trips/${tripId}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: groupLabel.trim(), allowMixedGenderRoom }),
        });
        const groupData = await groupRes.json();
        if (!groupRes.ok) {
          throw new Error(groupData.message || "Erreur lors de la création du groupe");
        }
        groupId = groupData.id;

        // Montant dû par défaut = prix du voyage (selon le type de chambre
        // demandé, sinon le plus bas) × nombre de voyageurs, pour ne pas
        // partir de 0 — reste modifiable ensuite (page du groupe).
        if (selectedTrip) {
          await fetch(`/api/admin/groups/${groupId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              totalDue: pickTripPrice(selectedTrip, preferredRoomType) * travelers.length,
            }),
          });
        }
      }

      const hotelPreferences = Object.entries(hotelPreferencesByCity)
        .filter(([, hotelId]) => hotelId)
        .map(([city, hotelId]) => ({ city, hotelId }));

      for (const traveler of travelers) {
        const res = await fetch("/api/admin/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            ...traveler,
            hotelPreferences,
            preferredRoomType: preferredRoomType || null,
            groupId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            `${traveler.fullName || "Voyageur"} : ${data.message || "Erreur lors de la création"}`
          );
        }
      }

      if (groupId) {
        router.push(`/admin/groupes/${groupId}`);
      } else {
        router.push("/admin/inscriptions");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Voyage</label>
        <select
          required
          value={tripId}
          onChange={handleTripChange}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Sélectionner un voyage</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title} — {trip.reference_code} (
              {new Date(trip.departure_date).toLocaleDateString("fr-FR")})
            </option>
          ))}
        </select>
        {selectedTrip && (
          <p className="mt-1 text-sm text-zinc-600">
            Prix : <span className="font-semibold text-zinc-900">
              {pickTripPrice(selectedTrip, preferredRoomType).toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
              })}{" "}
              {selectedTrip.currency}
            </span>{" "}
            par personne
            {travelers.length > 1 && (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-zinc-900">
                  {(
                    pickTripPrice(selectedTrip, preferredRoomType) * travelers.length
                  ).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                  {selectedTrip.currency}
                </span>{" "}
                pour {travelers.length} voyageurs
              </>
            )}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Type d&apos;inscription
        </label>
        <div className="mt-2 flex gap-3">
          {[
            { value: "individuel", label: "Individuel" },
            { value: "binome", label: "Binôme" },
            { value: "groupe", label: "Groupe" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeChange(opt.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                inscriptionType === opt.value
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {inscriptionType !== "individuel" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="block text-sm font-medium text-zinc-700">
            Nom du {inscriptionType === "binome" ? "binôme" : "groupe"}
          </label>
          <input
            required
            value={groupLabel}
            onChange={(e) => setGroupLabel(e.target.value)}
            placeholder="ex. Famille Alaoui, M. et Mme Idrissi"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={allowMixedGenderRoom}
              onChange={(e) => setAllowMixedGenderRoom(e.target.checked)}
            />
            Couple / famille — autoriser à partager une chambre entre genres
            différents
          </label>
          <p className="mt-2 text-xs text-zinc-500">
            Ce {inscriptionType === "binome" ? "binôme" : "groupe"} partagera un seul
            montant dû et un seul suivi de paiement (voir la page du groupe après
            création).
          </p>
        </div>
      )}

      <div>
        {hotelsLoading && (
          <p className="text-sm text-zinc-500">Chargement des hôtels du voyage...</p>
        )}
        {hotelsError && <p className="text-sm text-red-600">{hotelsError}</p>}
        {!hotelsLoading && !hotelsError && tripId && tripHotelsByCity.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucun hôtel disponible pour ce voyage — la préférence sera laissée de côté.
          </p>
        )}
        {tripHotelsByCity.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${tripHotelsByCity.length}, minmax(0, 1fr))` }}
          >
            {tripHotelsByCity.map((group) => (
              <div key={group.city}>
                <label className="block text-sm font-medium text-zinc-700">
                  Hôtel souhaité — {group.city} (optionnel)
                </label>
                <select
                  value={hotelPreferencesByCity[group.city] || ""}
                  onChange={(e) =>
                    setHotelPreferencesByCity((prev) => ({
                      ...prev,
                      [group.city]: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Aucune préférence</option>
                  {group.items.map((th) => (
                    <option key={th.hotel_id} value={th.hotel_id}>
                      {th.hotel_name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Type de chambre souhaité (optionnel)
        </label>
        <select
          value={preferredRoomType}
          onChange={(e) => setPreferredRoomType(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Aucune préférence</option>
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {travelers.map((traveler, index) => (
          <TravelerFields
            key={index}
            label={travelerLabel(index)}
            traveler={traveler}
            onChange={(updated) => updateTravelerAt(index, updated)}
            departureDate={selectedTrip?.departure_date}
            onRemove={
              inscriptionType === "groupe" && travelers.length > 1
                ? () => handleRemoveTraveler(index)
                : undefined
            }
          />
        ))}
      </div>

      {inscriptionType === "groupe" && (
        <button
          type="button"
          onClick={handleAddTraveler}
          className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Ajouter un voyageur
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting
          ? "Création..."
          : inscriptionType === "individuel"
          ? "Créer l'inscription"
          : `Créer le ${inscriptionType === "binome" ? "binôme" : "groupe"} (${travelers.length} voyageur${
              travelers.length > 1 ? "s" : ""
            })`}
      </button>
    </form>
  );
}
