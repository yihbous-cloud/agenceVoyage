"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AIRPORTS_REFERENCE, airportInputValue, extractIataFromInput, formatAirportOption } from "@/lib/airportsReference";

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
  const [originIata, setOriginIata] = useState(airportInputValue(trip?.origin_iata));
  const [destinationIata, setDestinationIata] = useState(airportInputValue(trip?.destination_iata));
  const [returnOriginIata, setReturnOriginIata] = useState(
    airportInputValue(trip?.return_origin_iata)
  );
  const [returnDestinationIata, setReturnDestinationIata] = useState(
    airportInputValue(trip?.return_destination_iata)
  );
  const [hasOutboundLayover, setHasOutboundLayover] = useState(
    !!trip?.outbound_layover_iata
  );
  const [outboundLayoverIata, setOutboundLayoverIata] = useState(
    airportInputValue(trip?.outbound_layover_iata)
  );
  const [hasReturnLayover, setHasReturnLayover] = useState(!!trip?.return_layover_iata);
  const [returnLayoverIata, setReturnLayoverIata] = useState(
    airportInputValue(trip?.return_layover_iata)
  );
  const [airlineId, setAirlineId] = useState(trip?.airline_id || "");
  const [totalSeats, setTotalSeats] = useState(trip?.total_seats ?? 0);
  const [priceDouble, setPriceDouble] = useState(trip?.price_double ?? 0);
  const [priceTriple, setPriceTriple] = useState(trip?.price_triple ?? 0);
  const [priceQuadruple, setPriceQuadruple] = useState(trip?.price_quadruple ?? 0);
  const [priceQuintuple, setPriceQuintuple] = useState(trip?.price_quintuple ?? 0);
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
      originIata: extractIataFromInput(originIata) || null,
      destinationIata: extractIataFromInput(destinationIata) || null,
      returnOriginIata: extractIataFromInput(returnOriginIata) || null,
      returnDestinationIata: extractIataFromInput(returnDestinationIata) || null,
      outboundLayoverIata: hasOutboundLayover
        ? extractIataFromInput(outboundLayoverIata) || null
        : null,
      returnLayoverIata: hasReturnLayover ? extractIataFromInput(returnLayoverIata) || null : null,
      airlineId: airlineId || null,
      totalSeats: Number(totalSeats),
      priceDouble: Number(priceDouble),
      priceTriple: Number(priceTriple),
      priceQuadruple: Number(priceQuadruple),
      priceQuintuple: Number(priceQuintuple),
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
          <label className="block text-sm font-medium text-zinc-700">Date d&apos;aller</label>
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

      <datalist id="airport-options">
        {AIRPORTS_REFERENCE.map((a) => (
          <option key={a.iata} value={formatAirportOption(a)} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport de départ — aller
          </label>
          <input
            list="airport-options"
            value={originIata}
            onChange={(e) => setOriginIata(e.target.value)}
            placeholder="Taper une ville ou un code..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport d&apos;arrivée — aller
          </label>
          <input
            list="airport-options"
            value={destinationIata}
            onChange={(e) => setDestinationIata(e.target.value)}
            placeholder="Taper une ville ou un code..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport de départ — retour (optionnel)
          </label>
          <input
            list="airport-options"
            value={returnOriginIata}
            onChange={(e) => setReturnOriginIata(e.target.value)}
            placeholder="Vide = arrivée aller inversée"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport d&apos;arrivée — retour (optionnel)
          </label>
          <input
            list="airport-options"
            value={returnDestinationIata}
            onChange={(e) => setReturnDestinationIata(e.target.value)}
            placeholder="Vide = départ aller inversé"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        Tapez le nom d&apos;une ville ou d&apos;un aéroport pour voir les suggestions (code IATA
        affiché entre parenthèses) — un aéroport absent de la liste reste saisissable librement.
        Nécessaires pour la recherche de vols Duffel. Aéroports du retour laissés vides = mêmes
        aéroports que l&apos;aller, sens inversé (cas le plus courant) ; à renseigner uniquement
        si le retour se fait depuis/vers un aéroport différent.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={hasOutboundLayover}
              onChange={(e) => {
                setHasOutboundLayover(e.target.checked);
                if (!e.target.checked) setOutboundLayoverIata("");
              }}
            />
            Voyage avec escale (Aller)
          </label>
          {hasOutboundLayover && (
            <input
              list="airport-options"
              value={outboundLayoverIata}
              onChange={(e) => setOutboundLayoverIata(e.target.value)}
              placeholder="Taper une ville ou un code..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={hasReturnLayover}
              onChange={(e) => {
                setHasReturnLayover(e.target.checked);
                if (!e.target.checked) setReturnLayoverIata("");
              }}
            />
            Voyage avec escale (Retour)
          </label>
          {hasReturnLayover && (
            <input
              list="airport-options"
              value={returnLayoverIata}
              onChange={(e) => setReturnLayoverIata(e.target.value)}
              placeholder="Taper une ville ou un code..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Places totales</label>
        <input
          type="number"
          min="0"
          value={totalSeats}
          onChange={(e) => setTotalSeats(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700">Prix par personne, par type de chambre</p>
        <div className="mt-1 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500">Chambre double / binôme</label>
            <input
              required
              type="number"
              step="0.01"
              value={priceDouble}
              onChange={(e) => setPriceDouble(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Chambre triple</label>
            <input
              required
              type="number"
              step="0.01"
              value={priceTriple}
              onChange={(e) => setPriceTriple(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Chambre quadruple</label>
            <input
              required
              type="number"
              step="0.01"
              value={priceQuadruple}
              onChange={(e) => setPriceQuadruple(e.target.value)}
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
              value={priceQuintuple}
              onChange={(e) => setPriceQuintuple(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Le prix affiché publiquement est toujours le plus bas des quatre (généralement le prix
          quintuple).
        </p>
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
