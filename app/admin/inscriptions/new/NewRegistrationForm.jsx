"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_TYPES } from "@/lib/roomTypes";

const initialState = {
  tripId: "",
  fullName: "",
  fullNameArabic: "",
  gender: "homme",
  dateOfBirth: "",
  nationalId: "",
  passportNumber: "",
  passportExpiryDate: "",
  phoneWhatsapp: "",
  email: "",
  address: "",
  preferredHotelId: "",
  preferredRoomType: "",
};

export default function NewRegistrationForm({ trips }) {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tripHotels, setTripHotels] = useState([]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleTripChange = async (e) => {
    const tripId = e.target.value;
    setForm({ ...form, tripId, preferredHotelId: "" });
    setTripHotels([]);
    if (!tripId) return;
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/hotels`);
      if (res.ok) setTripHotels(await res.json());
    } catch {
      // pas bloquant : la préférence d'hôtel reste optionnelle
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          preferredHotelId: form.preferredHotelId || null,
          preferredRoomType: form.preferredRoomType || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la création");
      }

      router.push("/admin/inscriptions");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Voyage</label>
        <select
          required
          value={form.tripId}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Hôtel souhaité (optionnel)
          </label>
          <select
            value={form.preferredHotelId}
            onChange={set("preferredHotelId")}
            disabled={!form.tripId}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            <option value="">
              {form.tripId ? "Aucune préférence" : "Choisir un voyage d'abord"}
            </option>
            {tripHotels.map((th) => (
              <option key={th.hotel_id} value={th.hotel_id}>
                {th.hotel_name} ({th.city})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Type de chambre souhaité (optionnel)
          </label>
          <select
            value={form.preferredRoomType}
            onChange={set("preferredRoomType")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Aucune préférence</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
          <input required value={form.fullName} onChange={set("fullName")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom en arabe</label>
          <input value={form.fullNameArabic} onChange={set("fullNameArabic")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Genre</label>
          <select value={form.gender} onChange={set("gender")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Date de naissance</label>
          <input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">CIN</label>
          <input value={form.nationalId} onChange={set("nationalId")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">N° Passeport</label>
          <input value={form.passportNumber} onChange={set("passportNumber")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Expiration passeport</label>
          <input type="date" value={form.passportExpiryDate} onChange={set("passportExpiryDate")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">WhatsApp</label>
          <input required value={form.phoneWhatsapp} onChange={set("phoneWhatsapp")} placeholder="+212 6XX XXX XXX" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input type="email" value={form.email} onChange={set("email")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Adresse</label>
          <input value={form.address} onChange={set("address")} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Création..." : "Créer l'inscription"}
      </button>
    </form>
  );
}
