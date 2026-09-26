"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, getCitiesForCountry } from "@/lib/worldPlaces";
import { BOOKABLE_ROOM_TYPES, BOARD_BASIS_OPTIONS } from "@/lib/roomTypes";

const RESERVED_ROOMS_FIELD = {
  double: "reservedRoomsDouble",
  triple: "reservedRoomsTriple",
  quadruple: "reservedRoomsQuadruple",
  quintuple: "reservedRoomsQuintuple",
};

function emptyForm() {
  return {
    name: "",
    city: "",
    country: "Arabie Saoudite",
    starRating: "",
    landmarkName: "",
    landmarkDistanceM: "",
    contactInfo: "",
    boardBasis: "logement_seul",
    reservedRoomsDouble: "",
    reservedRoomsTriple: "",
    reservedRoomsQuadruple: "",
    reservedRoomsQuintuple: "",
  };
}

function hotelToFormValues(h) {
  return {
    name: h.name || "",
    city: h.city || "",
    country: h.country || "Arabie Saoudite",
    starRating: h.star_rating || "",
    landmarkName: h.landmark_name || "",
    landmarkDistanceM: h.landmark_distance_m ?? "",
    contactInfo: h.contact_info || "",
    boardBasis: h.board_basis || "logement_seul",
    reservedRoomsDouble: h.reserved_rooms_double ?? "",
    reservedRoomsTriple: h.reserved_rooms_triple ?? "",
    reservedRoomsQuadruple: h.reserved_rooms_quadruple ?? "",
    reservedRoomsQuintuple: h.reserved_rooms_quintuple ?? "",
  };
}

// vide = NULL (ce type n'existe pas dans cet hôtel), distinct de 0 (existe
// mais aucune réservée) — voir CLAUDE.md.
function buildPayload(form) {
  return {
    ...form,
    starRating: form.starRating === "" ? null : form.starRating,
    landmarkDistanceM: form.landmarkDistanceM === "" ? null : Number(form.landmarkDistanceM),
    reservedRoomsDouble: form.reservedRoomsDouble === "" ? null : Number(form.reservedRoomsDouble),
    reservedRoomsTriple: form.reservedRoomsTriple === "" ? null : Number(form.reservedRoomsTriple),
    reservedRoomsQuadruple:
      form.reservedRoomsQuadruple === "" ? null : Number(form.reservedRoomsQuadruple),
    reservedRoomsQuintuple:
      form.reservedRoomsQuintuple === "" ? null : Number(form.reservedRoomsQuintuple),
  };
}

function HotelForm({ initial, onSubmit, onCancel, submitting, submitLabel }) {
  const [form, setForm] = useState(initial ? hotelToFormValues(initial) : emptyForm());
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Changer de pays remet la ville à zéro : ses suggestions ne
  // correspondent plus (la ville reste saisissable librement).
  const handleCountryChange = (e) => {
    setForm((f) => ({ ...f, country: e.target.value, city: "" }));
  };

  const cityOptions = getCitiesForCountry(form.country);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(buildPayload(form));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-2xl grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom</label>
        <input
          required
          value={form.name}
          onChange={set("name")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Pays</label>
        <input
          list="hotel-countries"
          value={form.country}
          onChange={handleCountryChange}
          placeholder="Taper pour rechercher..."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <datalist id="hotel-countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Ville</label>
        <input
          required
          list="hotel-cities"
          value={form.city}
          onChange={set("city")}
          placeholder={cityOptions.length ? "Taper pour rechercher..." : "ex : Makka, Madina"}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <datalist id="hotel-cities">
          {cityOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-zinc-400">
          Choisir un pays pour suggérer ses villes, ou saisir librement.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Étoiles</label>
        <input
          value={form.starRating}
          onChange={set("starRating")}
          placeholder="ex : 4, 5+"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Point de repère à proximité
        </label>
        <input
          value={form.landmarkName}
          onChange={set("landmarkName")}
          placeholder="ex : Haram, Masjid Nabawi, Tour Eiffel..."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Laisser vide si la proximité à un lieu précis n&apos;est pas pertinente.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Distance (m)</label>
        <input
          type="number"
          value={form.landmarkDistanceM}
          onChange={set("landmarkDistanceM")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Contact</label>
        <input
          value={form.contactInfo}
          onChange={set("contactInfo")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Restauration</label>
        <select
          value={form.boardBasis}
          onChange={set("boardBasis")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {BOARD_BASIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-zinc-700">
          Chambres réservées pour l&apos;agence, par type
        </label>
        <p className="mt-1 text-xs text-zinc-400">
          Quota de planification, distinct des chambres réelles créées par voyage dans
          l&apos;hébergement. Laisser vide si ce type de chambre n&apos;existe pas dans cet hôtel
          (ex : pas de chambre quintuple) — vide et 0 ont un sens différent.
        </p>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {BOOKABLE_ROOM_TYPES.map((rt) => (
            <div key={rt}>
              <label className="block text-xs capitalize text-zinc-500">{rt}</label>
              <input
                type="number"
                min="0"
                value={form[RESERVED_ROOMS_FIELD[rt]]}
                onChange={set(RESERVED_ROOMS_FIELD[rt])}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function HotelsManager({ initialHotels, canManage }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Change de clé après une création réussie pour forcer le remontage du
  // formulaire de création (state interne à HotelForm) et le vider —
  // remplace l'ancien setForm(initialForm) devenu impossible à appeler
  // depuis l'extérieur du composant.
  const [createFormKey, setCreateFormKey] = useState(0);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la création");
      }
      setCreateFormKey((k) => k + 1);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id, payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hotels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la modification");
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
    if (!confirm("Supprimer cet hôtel ?")) return;
    await fetch(`/api/admin/hotels/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Étoiles</th>
              <th className="px-4 py-3">Point de repère</th>
              <th className="px-4 py-3">Restauration</th>
              <th className="px-4 py-3">Chambres réservées</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {initialHotels.map((h) =>
              editingId === h.id ? (
                <tr key={h.id} className="border-b border-zinc-100 last:border-0">
                  <td colSpan={7} className="px-4 py-4">
                    <HotelForm
                      initial={h}
                      submitting={submitting}
                      submitLabel="Enregistrer"
                      onCancel={() => setEditingId(null)}
                      onSubmit={(payload) => handleUpdate(h.id, payload)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={h.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{h.name}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {h.city}, {h.country}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {h.star_rating ? `${h.star_rating} ★` : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {h.landmark_distance_m != null
                      ? `${h.landmark_distance_m} m${h.landmark_name ? ` du ${h.landmark_name}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {BOARD_BASIS_OPTIONS.find((o) => o.value === h.board_basis)?.label || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {BOOKABLE_ROOM_TYPES.map((rt) => ({ rt, count: h[`reserved_rooms_${rt}`] }))
                      .filter(({ count }) => count > 0)
                      .map(({ rt, count }) => `${count} ${rt}`)
                      .join(", ") || "—"}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingId(h.id)}
                        className="mr-3 text-emerald-700 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
            {initialHotels.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                  Aucun hôtel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <HotelForm
          key={createFormKey}
          submitting={submitting}
          submitLabel="Ajouter l'hôtel"
          onSubmit={handleCreate}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
