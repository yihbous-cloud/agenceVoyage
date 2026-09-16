"use client";

import { useState } from "react";

export default function ContactForm() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'envoi");
      }
      setStatus({ type: "success", message: "Message envoyé, nous vous répondrons rapidement." });
      setForm({ fullName: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6">
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
        <label className="block text-sm font-medium text-zinc-700">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={set("email")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Téléphone (optionnel)</label>
        <input
          value={form.phone}
          onChange={set("phone")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Sujet</label>
        <input
          value={form.subject}
          onChange={set("subject")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Message</label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={set("message")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting ? "Envoi..." : "Envoyer"}
      </button>
      {status && (
        <p className={`text-sm ${status.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
          {status.message}
        </p>
      )}
    </form>
  );
}
