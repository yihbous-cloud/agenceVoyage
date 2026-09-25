"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HotelsCard({
  program,
  hotels,
  defaultHotelIds,
  tripHotelsCount,
  roomsCount,
  primaryTripId,
  canManage,
  onSuccess,
}) {
  const router = useRouter();
  const [selectedHotelIds, setSelectedHotelIds] = useState(
    defaultHotelIds.map((id) => String(id))
  );
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hotelsByCity = [];
  const seenCities = new Map();
  for (const h of hotels) {
    if (!seenCities.has(h.city)) {
      seenCities.set(h.city, { city: h.city, items: [] });
      hotelsByCity.push(seenCities.get(h.city));
    }
    seenCities.get(h.city).items.push(h);
  }

  const handleSelectChange = (e) => {
    setSelectedHotelIds(Array.from(e.target.selectedOptions, (o) => o.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultHotelIds: selectedHotelIds.map((id) => Number(id)),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Hôtels habituels de ce programme
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Sert de catalogue restreint sur la page hébergement et de repli pour la préférence
          d&apos;hôtel à l&apos;inscription.
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
          <select
            multiple
            disabled={!canManage}
            value={selectedHotelIds}
            onChange={handleSelectChange}
            className="mt-2 h-40 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
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
        )}
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

      {primaryTripId && (
        <p className="border-t border-zinc-100 pt-3 text-sm text-zinc-600">
          {tripHotelsCount} hôtel{tripHotelsCount > 1 ? "s" : ""} attaché
          {tripHotelsCount > 1 ? "s" : ""} au voyage principal, {roomsCount} chambre
          {roomsCount > 1 ? "s" : ""} créée{roomsCount > 1 ? "s" : ""} —{" "}
          <Link
            href={`/admin/voyages/${primaryTripId}/hebergement`}
            className="text-emerald-700 hover:underline"
          >
            Gérer l&apos;hébergement →
          </Link>
        </p>
      )}
    </form>
  );
}
