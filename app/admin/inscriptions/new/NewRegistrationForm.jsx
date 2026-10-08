"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKABLE_ROOM_TYPES, pickTripPrice, pickTierPrice } from "@/lib/roomTypes";
import TravelerFields from "./TravelerFields";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

const emptyTraveler = () => ({
  fullName: "",
  fullNameArabic: "",
  gender: "homme",
  dateOfBirth: "",
  nationalId: "",
  passportNumber: "",
  passportIssueDate: "",
  passportExpiryDate: "",
  phone: "",
  phoneWhatsapp: "",
  additionalPhoneNumbers: [],
  email: "",
  address: "",
});

const TRAVELER_COUNT_LABELS = {
  individuel: "Voyageur",
  binome: ["Premier voyageur", "Deuxième voyageur"],
};

export default function NewRegistrationForm({ trips, initialTripId = null }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  // Voyage pré-sélectionné depuis un bouton « Inscrire » (tableau de bord,
  // liste des programmes) : ?tripId= / ?programId= lus par page.js.
  const [tripId, setTripId] = useState(initialTripId ? String(initialTripId) : "");

  // Type d'inscription : individuel (1 voyageur), binôme (exactement 2,
  // ex. un couple) ou groupe (1 à N, extensible via "+ Ajouter un
  // voyageur") — voir CLAUDE.md §3quindecies.
  const [inscriptionType, setInscriptionType] = useState("individuel");
  const [travelers, setTravelers] = useState([emptyTraveler()]);
  const [groupLabel, setGroupLabel] = useState("");
  const [allowMixedGenderRoom, setAllowMixedGenderRoom] = useState(false);

  const [preferredRoomType, setPreferredRoomType] = useState("");

  // Tarifs d'hébergement (Omra/Hajj uniquement, voir CLAUDE.md) — un tarif
  // choisi remplace le prix plat du voyage par le prix de son type de
  // chambre, et fait partie du payload de l'inscription.
  const [tiers, setTiers] = useState([]);
  const [tiersLoading, setTiersLoading] = useState(
    () => Boolean(initialTripId) && trips.find((t) => String(t.id) === String(initialTripId))?.family === "omra_hajj"
  );
  const [tiersError, setTiersError] = useState(null);
  const [selectedTierId, setSelectedTierId] = useState("");

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTrip = trips.find((t) => String(t.id) === String(tripId));

  const loadTiers = async (value) => {
    try {
      const res = await fetch(`/api/admin/trips/${value}/tiers`);
      if (res.ok) {
        setTiers(await res.json());
      } else {
        setTiersError("Impossible de charger les tarifs d'hébergement de ce voyage (erreur serveur).");
      }
    } catch {
      setTiersError("Impossible de charger les tarifs d'hébergement de ce voyage (connexion).");
    } finally {
      setTiersLoading(false);
    }
  };

  // Voyage pré-sélectionné : charge ses tarifs d'hébergement dès l'ouverture.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current || !initialTripId) return;
    initialLoadDone.current = true;
    const trip = trips.find((t) => String(t.id) === String(initialTripId));
    if (trip?.family !== "omra_hajj") return;
    fetch(`/api/admin/trips/${initialTripId}/tiers`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("server"))))
      .then((data) => setTiers(data))
      .catch((err) =>
        setTiersError(
          err.message === "server"
            ? "Impossible de charger les tarifs d'hébergement de ce voyage (erreur serveur)."
            : "Impossible de charger les tarifs d'hébergement de ce voyage (connexion)."
        )
      )
      .finally(() => setTiersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTripChange = async (e) => {
    const value = e.target.value;
    setTripId(value);
    setTiers([]);
    setTiersError(null);
    setSelectedTierId("");
    if (!value) return;

    const trip = trips.find((t) => String(t.id) === String(value));
    if (trip?.family === "omra_hajj") {
      setTiersLoading(true);
      await loadTiers(value);
    }
  };

  const selectedTier = tiers.find((t) => String(t.id) === String(selectedTierId));
  const unitPrice = selectedTrip
    ? selectedTier
      ? pickTierPrice(selectedTier.prices, preferredRoomType)
      : pickTripPrice(selectedTrip, preferredRoomType)
    : 0;

  const handleTypeChange = (type) => {
    setInscriptionType(type);
    if (type === "individuel") {
      setTravelers((prev) => [prev[0] || emptyTraveler()]);
    } else if (type === "binome") {
      setTravelers((prev) => [prev[0] || emptyTraveler(), prev[1] || emptyTraveler()]);
      // Un binôme, c'est exactement 2 personnes — la chambre double est la
      // seule qui a du sens, verrouillée tant que le type reste "binôme"
      // (voir le <select> plus bas).
      setPreferredRoomType("double");
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

        // Montant dû par défaut = prix du tarif choisi (ou du voyage selon
        // le type de chambre demandé, sinon le plus bas) × nombre de
        // voyageurs, pour ne pas partir de 0 — reste modifiable ensuite
        // (page du groupe).
        if (selectedTrip) {
          await fetch(`/api/admin/groups/${groupId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              totalDue: unitPrice * travelers.length,
            }),
          });
        }
      }

      for (const traveler of travelers) {
        const res = await fetch("/api/admin/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            ...traveler,
            preferredRoomType: preferredRoomType || null,
            selectedTierId: selectedTierId || null,
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
      <h2 className="text-lg font-semibold text-zinc-900">Informations Voyageurs</h2>

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
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900" translate="no">
              {selectedTrip.title}
            </span>
            <span>
              {new Date(selectedTrip.departure_date).toLocaleDateString("fr-FR")}
              {selectedTrip.return_date &&
                ` – ${new Date(selectedTrip.return_date).toLocaleDateString("fr-FR")}`}
            </span>
            {(selectedTrip.origin_iata || selectedTrip.destination_iata) && (
              <span className="font-mono" translate="no">
                {selectedTrip.origin_iata || "—"} → {selectedTrip.destination_iata || "—"}
              </span>
            )}
            {(selectedTrip.destination_city || selectedTrip.destination_country) && (
              <span>
                {[selectedTrip.destination_city, selectedTrip.destination_country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        )}
        {selectedTrip && tiers.length > 0 && !selectedTier && (
          <p className="mt-1 text-sm text-zinc-600">
            Prix : selon le tarif d&apos;hébergement choisi ci-dessous.
          </p>
        )}
        {selectedTrip && !(tiers.length > 0 && !selectedTier) && (
          <p className="mt-1 text-sm text-zinc-600">
            Prix : <span className="font-semibold text-zinc-900">
              {unitPrice.toLocaleString("fr-FR", {
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
                  {(unitPrice * travelers.length).toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {selectedTrip.currency}
                </span>{" "}
                pour {travelers.length} voyageurs
              </>
            )}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <label className="block text-sm font-medium text-zinc-700">
          Nom du groupe / binôme
        </label>
        <input
          required={inscriptionType !== "individuel"}
          disabled={inscriptionType === "individuel"}
          value={groupLabel}
          onChange={(e) => setGroupLabel(e.target.value)}
          placeholder="ex. Famille Alaoui, M. et Mme Idrissi"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            disabled={inscriptionType === "individuel"}
            checked={allowMixedGenderRoom}
            onChange={(e) => setAllowMixedGenderRoom(e.target.checked)}
          />
          Couple / famille — autoriser à partager une chambre entre genres
          différents
        </label>
        {inscriptionType !== "individuel" && (
          <p className="mt-2 text-xs text-zinc-500">
            Ce {inscriptionType === "binome" ? "binôme" : "groupe"} partagera un seul
            montant dû et un seul suivi de paiement (voir la page du groupe après
            création).
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

      {selectedTrip?.family === "omra_hajj" && (
        <div>
          {tiersLoading && (
            <p className="text-sm text-zinc-500">Chargement des tarifs d&apos;hébergement...</p>
          )}
          {tiersError && <p className="text-sm text-red-600">{tiersError}</p>}
          {!tiersLoading && !tiersError && tiers.length > 0 && (
            <>
              <label className="block text-sm font-medium text-zinc-700">
                Tarif d&apos;hébergement
              </label>
              <select
                required
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Sélectionner un tarif...</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label} — {tier.makkah_hotel_name} + {tier.madinah_hotel_name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Type de chambre souhaité
        </label>
        <select
          value={preferredRoomType}
          onChange={(e) => setPreferredRoomType(e.target.value)}
          disabled={inscriptionType === "binome"}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
        >
          <option value="">Aucune préférence</option>
          {BOOKABLE_ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {inscriptionType === "binome" && (
          <p className="mt-1 text-xs text-zinc-500">
            Chambre double automatique pour un binôme.
          </p>
        )}
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
          : `${tr(inscriptionType === "binome" ? "Créer le binôme" : "Créer le groupe")} (${tr.plural(
              "{count} voyageur",
              "{count} voyageurs",
              travelers.length
            )})`}
      </button>
    </form>
  );
}
