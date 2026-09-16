"use client";

import { useState } from "react";

export default function ReservationForm({ tripId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phoneWhatsapp: "",
    email: "",
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, ...form }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la réservation");
      }

      setStatus({ type: "success", message: "Inscription enregistrée ! Nous vous contacterons sur WhatsApp." });
      setForm({ fullName: "", phoneWhatsapp: "", email: "" });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 bg-gold px-5 py-2 text-sm font-medium tracking-wide text-ink uppercase hover:bg-gold-light"
      >
        S&apos;inscrire
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
        <input
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Numéro WhatsApp
        </label>
        <input
          required
          value={form.phoneWhatsapp}
          onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
          placeholder="+212 6XX XXX XXX"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Email (optionnel)
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gold px-5 py-2 text-sm font-medium tracking-wide text-ink uppercase hover:bg-gold-light disabled:opacity-60"
        >
          {submitting ? "Envoi..." : "Confirmer l'inscription"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Annuler
        </button>
      </div>
      {status && (
        <p
          className={`text-sm ${
            status.type === "success" ? "text-[#A8863C]" : "text-red-600"
          }`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
