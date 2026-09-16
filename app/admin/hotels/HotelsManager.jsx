"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, getCitiesForCountry } from "@/lib/worldPlaces";

const initialForm = {
  name: "",
  city: "",
  country: "Arabie Saoudite",
  starRating: "",
  landmarkName: "",
  landmarkDistanceM: "",
  contactInfo: "",
};

export default function HotelsManager({ initialHotels, canManage }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Changer de pays remet la ville à zéro : ses suggestions ne
  // correspondent plus (la ville reste saisissable librement).
  const handleCountryChange = (e) => {
    setForm((f) => ({ ...f, country: e.target.value, city: "" }));
  };

  const cityOptions = getCitiesForCountry(form.country);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          starRating: form.starRating === "" ? null : Number(form.starRating),
          landmarkDistanceM:
            form.landmarkDistanceM === "" ? null : Number(form.landmarkDistanceM),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la création");
      }
      setForm(initialForm);
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
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {initialHotels.map((h) => (
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
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {initialHotels.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={5}>
                  Aucun hôtel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form
          onSubmit={handleCreate}
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
              type="number"
              min="1"
              max="5"
              value={form.starRating}
              onChange={set("starRating")}
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
          <div className="col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Ajouter l&apos;hôtel
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
