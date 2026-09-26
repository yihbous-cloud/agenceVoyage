"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKABLE_ROOM_TYPES, BOARD_BASIS_OPTIONS } from "@/lib/roomTypes";

// La formule de restauration d'un tarif suit toujours celle du catalogue de
// l'hôtel choisi (hotels.board_basis, §3quaterquadragies) — plus un choix
// indépendant, verrouillée dans l'UI (voir CLAUDE.md).
function boardBasisForHotel(hotels, hotelId) {
  const hotel = hotels.find((h) => String(h.id) === String(hotelId));
  return hotel?.board_basis || "logement_seul";
}

function groupHotelsByCity(hotels) {
  const groups = [];
  const seen = new Map();
  for (const h of hotels) {
    if (!seen.has(h.city)) {
      seen.set(h.city, { city: h.city, items: [] });
      groups.push(seen.get(h.city));
    }
    seen.get(h.city).items.push(h);
  }
  return groups;
}

function TierForm({ hotels, initial, onSubmit, onCancel, submitting }) {
  const hotelsByCity = groupHotelsByCity(hotels);

  const [label, setLabel] = useState(initial?.label || "");
  const [makkahHotelId, setMakkahHotelId] = useState(initial?.makkah_hotel_id || "");
  const [madinahHotelId, setMadinahHotelId] = useState(initial?.madinah_hotel_id || "");

  // Dérivées du catalogue hôtel, jamais éditées indépendamment — voir
  // boardBasisForHotel ci-dessus.
  const makkahBoardBasis = boardBasisForHotel(hotels, makkahHotelId);
  const madinahBoardBasis = boardBasisForHotel(hotels, madinahHotelId);

  const initialPrices = {};
  for (const p of initial?.prices || []) {
    initialPrices[p.room_type] = { pricePerPerson: p.price_per_person, seatsLimit: p.seats_limit ?? "" };
  }
  const [priceRows, setPriceRows] = useState(
    BOOKABLE_ROOM_TYPES.reduce(
      (acc, rt) => ({
        ...acc,
        [rt]: initialPrices[rt] || { pricePerPerson: "", seatsLimit: "" },
      }),
      {}
    )
  );

  const updatePriceRow = (roomType, field, value) => {
    setPriceRows((prev) => ({ ...prev, [roomType]: { ...prev[roomType], [field]: value } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const prices = BOOKABLE_ROOM_TYPES.filter((rt) => priceRows[rt].pricePerPerson !== "").map((rt) => ({
      roomType: rt,
      pricePerPerson: priceRows[rt].pricePerPerson,
      seatsLimit: priceRows[rt].seatsLimit === "" ? null : Number(priceRows[rt].seatsLimit),
    }));
    onSubmit({
      label,
      makkahHotelId: Number(makkahHotelId),
      makkahBoardBasis,
      madinahHotelId: Number(madinahHotelId),
      madinahBoardBasis,
      prices,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom du tarif</label>
        <input
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex: Économique, Standard, VIP"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Hôtel Mecque</label>
          <select
            required
            value={makkahHotelId}
            onChange={(e) => setMakkahHotelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Sélectionner...</option>
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
          <select
            disabled
            value={makkahBoardBasis}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
          >
            {BOARD_BASIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Hôtel Médine</label>
          <select
            required
            value={madinahHotelId}
            onChange={(e) => setMadinahHotelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Sélectionner...</option>
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
          <select
            disabled
            value={madinahBoardBasis}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
          >
            {BOARD_BASIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        La restauration est celle définie sur la fiche de l&apos;hôtel choisi (catalogue), pas
        modifiable ici.
      </p>

      <div>
        <p className="text-sm font-medium text-zinc-700">Prix par personne, par type de chambre</p>
        <p className="mt-1 text-xs text-zinc-500">
          Laisser le prix vide pour un type de chambre non proposé sur ce tarif. Places vide =
          illimité.
        </p>
        <div className="mt-2 space-y-2">
          {BOOKABLE_ROOM_TYPES.map((rt) => (
            <div key={rt} className="grid grid-cols-3 items-center gap-2">
              <span className="text-sm capitalize text-zinc-700">{rt}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceRows[rt].pricePerPerson}
                onChange={(e) => updatePriceRow(rt, "pricePerPerson", e.target.value)}
                placeholder="Prix"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                value={priceRows[rt].seatsLimit}
                onChange={(e) => updatePriceRow(rt, "seatsLimit", e.target.value)}
                placeholder="Places (illimité)"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          Enregistrer
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-700">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function TiersCard({ trip, hotels, initialTiers, canManage }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trips/${trip.id}/tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur lors de l'ajout");
      }
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trip-hotel-tiers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur lors de la modification");
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce tarif ?")) return;
    const res = await fetch(`/api/admin/trip-hotel-tiers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Erreur lors de la suppression");
      return;
    }
    router.refresh();
  };

  if (!trip) {
    return <p className="text-sm text-zinc-500">Aucun voyage — rien à configurer pour l&apos;instant.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {initialTiers.map((tier) =>
          editingId === tier.id ? (
            <TierForm
              key={tier.id}
              hotels={hotels}
              initial={tier}
              submitting={submitting}
              onCancel={() => setEditingId(null)}
              onSubmit={(data) => handleUpdate(tier.id, data)}
            />
          ) : (
            <div key={tier.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900">{tier.label}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Mecque : {tier.makkah_hotel_name} ({tier.makkah_hotel_city}) —{" "}
                    {BOARD_BASIS_OPTIONS.find((o) => o.value === tier.makkah_board_basis)?.label}
                  </p>
                  <p className="text-sm text-zinc-600">
                    Médine : {tier.madinah_hotel_name} ({tier.madinah_hotel_city}) —{" "}
                    {BOARD_BASIS_OPTIONS.find((o) => o.value === tier.madinah_board_basis)?.label}
                  </p>
                  {tier.prices.length > 0 && (
                    <ul className="mt-2 text-sm text-zinc-600">
                      {tier.prices.map((p) => (
                        <li key={p.id}>
                          {p.room_type} : {p.price_per_person} —{" "}
                          {p.seats_limit === null ? "illimité" : `${p.seats_limit} place(s)`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button
                      onClick={() => setEditingId(tier.id)}
                      className="text-emerald-700 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(tier.id)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {initialTiers.length === 0 && !adding && (
          <p className="text-sm text-zinc-500">Aucun tarif d&apos;hébergement pour ce voyage.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage &&
        (adding ? (
          <TierForm hotels={hotels} submitting={submitting} onCancel={() => setAdding(false)} onSubmit={handleCreate} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            + Ajouter un tarif
          </button>
        ))}
    </div>
  );
}
