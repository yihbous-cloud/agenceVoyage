"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["planifie", "ouvert", "complet", "en_cours", "termine", "annule"];

export default function TripForm({ programId, trip, airlines, canDelete }) {
  const router = useRouter();
  const isEdit = !!trip;

  const [referenceCode, setReferenceCode] = useState(trip?.reference_code || "");
  const [departureDate, setDepartureDate] = useState(trip?.departure_date || "");
  const [returnDate, setReturnDate] = useState(trip?.return_date || "");
  const [destinationCountry, setDestinationCountry] = useState(
    trip?.destination_country || "Arabie Saoudite"
  );
  const [originIata, setOriginIata] = useState(trip?.origin_iata || "");
  const [destinationIata, setDestinationIata] = useState(trip?.destination_iata || "");
  const [airlineId, setAirlineId] = useState(trip?.airline_id || "");
  const [totalSeats, setTotalSeats] = useState(trip?.total_seats ?? 0);
  const [pricePerPerson, setPricePerPerson] = useState(trip?.price_per_person ?? 0);
  const [flightTicketPrice, setFlightTicketPrice] = useState(
    trip?.flight_ticket_price ?? ""
  );
  const [currency, setCurrency] = useState(trip?.currency || "MAD");
  const [status, setStatus] = useState(trip?.status || "planifie");
  const [notes, setNotes] = useState(trip?.notes || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      referenceCode,
      departureDate,
      returnDate,
      destinationCountry,
      originIata: originIata || null,
      destinationIata: destinationIata || null,
      airlineId: airlineId || null,
      totalSeats: Number(totalSeats),
      pricePerPerson: Number(pricePerPerson),
      flightTicketPrice: flightTicketPrice === "" ? null : Number(flightTicketPrice),
      currency,
      status,
      notes: notes || null,
    };

    try {
      const url = isEdit
        ? `/api/admin/trips/${trip.id}`
        : `/api/admin/programs/${programId}/trips`;
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
        router.push(`/admin/programmes/${trip.program_id}`);
      } else {
        // Le voyage vient d'être créé : on enchaîne directement sur
        // l'attachement de ses hôtels plutôt que de revenir sur la fiche
        // programme — l'hébergement se configure dès la création du voyage
        // (voir CLAUDE.md).
        const data = await res.json();
        router.push(`/admin/voyages/${data.id}/hebergement`);
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce voyage ?")) return;
    const res = await fetch(`/api/admin/trips/${trip.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message);
      return;
    }
    router.push(`/admin/programmes/${trip.program_id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Référence (ex: GF-OMR-2027-03)
          </label>
          <input
            required
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Date de départ</label>
          <input
            type="date"
            required
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Date de retour</label>
          <input
            type="date"
            required
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
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
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Compagnie aérienne
          </label>
          <select
            value={airlineId}
            onChange={(e) => setAirlineId(e.target.value)}
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
            Aéroport de départ (IATA)
          </label>
          <input
            maxLength={3}
            value={originIata}
            onChange={(e) => setOriginIata(e.target.value.toUpperCase())}
            placeholder="ex: CMN"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport d&apos;arrivée (IATA)
          </label>
          <input
            maxLength={3}
            value={destinationIata}
            onChange={(e) => setDestinationIata(e.target.value.toUpperCase())}
            placeholder="ex: JED"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        Codes IATA à 3 lettres, nécessaires pour la recherche de vols Duffel.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Places totales</label>
          <input
            type="number"
            min="0"
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Prix programme
          </label>
          <input
            type="number"
            step="0.01"
            value={pricePerPerson}
            onChange={(e) => setPricePerPerson(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Prix billet avion
          </label>
          <input
            type="number"
            step="0.01"
            value={flightTicketPrice}
            onChange={(e) => setFlightTicketPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Devise</label>
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1 w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

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
            Supprimer ce voyage
          </button>
        )}
      </div>
    </form>
  );
}
