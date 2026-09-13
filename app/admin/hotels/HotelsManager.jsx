"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const initialForm = {
  name: "",
  city: "",
  country: "Arabie Saoudite",
  starRating: "",
  distanceToHaramM: "",
  contactInfo: "",
};

export default function HotelsManager({ initialHotels, canManage }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

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
          distanceToHaramM:
            form.distanceToHaramM === "" ? null : Number(form.distanceToHaramM),
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
              <th className="px-4 py-3">Distance Haram</th>
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
                  {h.distance_to_haram_m != null ? `${h.distance_to_haram_m} m` : "—"}
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
            <label className="block text-sm font-medium text-zinc-700">Ville</label>
            <input
              required
              value={form.city}
              onChange={set("city")}
              placeholder="ex: La Mecque, Médine"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Pays</label>
            <input
              value={form.country}
              onChange={set("country")}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
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
              Distance du Haram (m)
            </label>
            <input
              type="number"
              value={form.distanceToHaramM}
              onChange={set("distanceToHaramM")}
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
