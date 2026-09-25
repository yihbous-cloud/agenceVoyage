"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PricingCard({ trip, canManage, onSuccess }) {
  const router = useRouter();

  const [totalSeats, setTotalSeats] = useState(trip?.total_seats ?? 0);
  const [priceDouble, setPriceDouble] = useState(trip?.price_double ?? 0);
  const [priceTriple, setPriceTriple] = useState(trip?.price_triple ?? 0);
  const [priceQuadruple, setPriceQuadruple] = useState(trip?.price_quadruple ?? 0);
  const [priceQuintuple, setPriceQuintuple] = useState(trip?.price_quintuple ?? 0);
  const [currency, setCurrency] = useState(trip?.currency || "MAD");

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
          totalSeats: Number(totalSeats),
          priceDouble: Number(priceDouble),
          priceTriple: Number(priceTriple),
          priceQuadruple: Number(priceQuadruple),
          priceQuintuple: Number(priceQuintuple),
          currency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip) {
    return <p className="text-sm text-zinc-500">Aucun voyage — rien à configurer pour l&apos;instant.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Places totales</label>
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
          <label className="block text-sm font-medium text-zinc-700">Devise</label>
          <input
            disabled={!canManage}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
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
              disabled={!canManage}
              value={priceDouble}
              onChange={(e) => setPriceDouble(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Chambre triple</label>
            <input
              required
              type="number"
              step="0.01"
              disabled={!canManage}
              value={priceTriple}
              onChange={(e) => setPriceTriple(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Chambre quadruple</label>
            <input
              required
              type="number"
              step="0.01"
              disabled={!canManage}
              value={priceQuadruple}
              onChange={(e) => setPriceQuadruple(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
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
              disabled={!canManage}
              value={priceQuintuple}
              onChange={(e) => setPriceQuintuple(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Le prix affiché publiquement est toujours le plus bas des quatre (généralement le prix
          quintuple).
        </p>
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
