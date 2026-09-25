"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIRPORTS_REFERENCE,
  airportInputValue,
  extractIataFromInput,
  formatAirportOption,
} from "@/lib/airportsReference";

export default function AirportCard({ trip, airlines, canManage }) {
  const router = useRouter();

  const [airlineId, setAirlineId] = useState(trip?.airline_id || "");
  const [destinationIata, setDestinationIata] = useState(
    airportInputValue(trip?.destination_iata)
  );
  const [returnOriginIata, setReturnOriginIata] = useState(
    airportInputValue(trip?.return_origin_iata)
  );
  const [returnDestinationIata, setReturnDestinationIata] = useState(
    airportInputValue(trip?.return_destination_iata)
  );
  const [hasOutboundLayover, setHasOutboundLayover] = useState(!!trip?.outbound_layover_iata);
  const [outboundLayoverIata, setOutboundLayoverIata] = useState(
    airportInputValue(trip?.outbound_layover_iata)
  );
  const [hasReturnLayover, setHasReturnLayover] = useState(!!trip?.return_layover_iata);
  const [returnLayoverIata, setReturnLayoverIata] = useState(
    airportInputValue(trip?.return_layover_iata)
  );

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/trips/${trip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airlineId: airlineId || null,
          destinationIata: extractIataFromInput(destinationIata) || null,
          returnOriginIata: extractIataFromInput(returnOriginIata) || null,
          returnDestinationIata: extractIataFromInput(returnDestinationIata) || null,
          outboundLayoverIata: hasOutboundLayover
            ? extractIataFromInput(outboundLayoverIata) || null
            : null,
          returnLayoverIata: hasReturnLayover
            ? extractIataFromInput(returnLayoverIata) || null
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip) {
    return (
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Aéroport</h2>
        <p className="text-sm text-zinc-500">Aucun voyage — rien à configurer pour l&apos;instant.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Aéroport</h2>

      <datalist id="airport-card-options">
        {AIRPORTS_REFERENCE.map((a) => (
          <option key={a.iata} value={formatAirportOption(a)} />
        ))}
      </datalist>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Compagnie aérienne</label>
        <select
          disabled={!canManage}
          value={airlineId}
          onChange={(e) => setAirlineId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        >
          <option value="">Aucune</option>
          {airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Aéroport d&apos;arrivée — aller
        </label>
        <input
          list="airport-card-options"
          disabled={!canManage}
          value={destinationIata}
          onChange={(e) => setDestinationIata(e.target.value)}
          placeholder="Taper une ville ou un code..."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport de départ — retour (optionnel)
          </label>
          <input
            list="airport-card-options"
            disabled={!canManage}
            value={returnOriginIata}
            onChange={(e) => setReturnOriginIata(e.target.value)}
            placeholder="Vide = arrivée aller inversée"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Aéroport d&apos;arrivée — retour (optionnel)
          </label>
          <input
            list="airport-card-options"
            disabled={!canManage}
            value={returnDestinationIata}
            onChange={(e) => setReturnDestinationIata(e.target.value)}
            placeholder="Vide = départ aller inversé"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        La ville de départ se modifie dans la carte "Informations". Aéroports du retour laissés
        vides = mêmes aéroports que l&apos;aller, sens inversé.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              disabled={!canManage}
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
              list="airport-card-options"
              disabled={!canManage}
              value={outboundLayoverIata}
              onChange={(e) => setOutboundLayoverIata(e.target.value)}
              placeholder="Taper une ville ou un code..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              disabled={!canManage}
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
              list="airport-card-options"
              disabled={!canManage}
              value={returnLayoverIata}
              onChange={(e) => setReturnLayoverIata(e.target.value)}
              placeholder="Taper une ville ou un code..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
