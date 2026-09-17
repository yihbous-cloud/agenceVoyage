"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewVisaServiceForm({ visaTypes }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    gender: "homme",
    phoneWhatsapp: "",
    email: "",
    visaTypeId: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/visa-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la création");
      }
      router.push(`/admin/visa-services/${data.id}`);
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
        <label className="block text-sm font-medium text-zinc-700">
          Type de visa (par destination)
        </label>
        <select
          required
          value={form.visaTypeId}
          onChange={set("visaTypeId")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Sélectionner...</option>
          {visaTypes.map((vt) => (
            <option key={vt.id} value={vt.id}>
              {vt.name}
              {vt.country ? ` (${vt.country})` : ""} — {vt.price} MAD
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
          <input
            required
            value={form.fullName}
            onChange={set("fullName")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Genre</label>
          <select
            value={form.gender}
            onChange={set("gender")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">WhatsApp</label>
          <input
            required
            value={form.phoneWhatsapp}
            onChange={set("phoneWhatsapp")}
            placeholder="+212 6XX XXX XXX"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Création..." : "Créer la demande"}
      </button>
    </form>
  );
}
