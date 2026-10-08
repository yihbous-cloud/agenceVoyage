"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminLocale } from "../_components/AdminLocale";
import Icon from "../_components/Icon";
import { initialsOf } from "../_components/statusStyles";

const INPUT = "mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm";
const CARD_STYLE = { boxShadow: "0 30px 80px -30px rgba(16,16,20,.25)" };

// Formulaire de demande de compte (migration 041). Le compte créé reste
// inactif tant qu'un administrateur ne l'a pas validé ; le rôle est choisi
// par l'administrateur à la validation (pas par le demandeur).
export default function SignupForm() {
  const { brandName } = useAdminLocale();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    website: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Les deux mots de passe ne correspondent pas");
      return;
    }
    setSubmitting(true);
    try {
      const { confirm, ...payload } = form;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Envoi impossible");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 pb-2">
      <span className="gf-logo" style={{ width: 40, height: 40, fontSize: 15 }} translate="no">
        {initialsOf(brandName)}
      </span>
      <div className="min-w-0">
        <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em" }}>Demande de compte</h1>
        <p className="text-sm text-zinc-500" translate="no">
          {brandName}
        </p>
      </div>
    </div>
  );

  const backLink = (
    <div className="flex justify-center border-t border-zinc-200 pt-4">
      <Link href="/admin/login" className="gf-btn-outline">
        <Icon name="arrow_back" size={16} className="rtl:rotate-180" />
        Retour à la connexion
      </Link>
    </div>
  );

  if (sent) {
    return (
      <div className="gf-card w-full max-w-md space-y-4 p-8" style={CARD_STYLE}>
        {header}
        <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          <Icon name="hourglass_top" size={20} />
          <div className="space-y-1">
            <p className="font-medium">Demande envoyée</p>
            <p>Votre compte est en attente de validation par un administrateur. Vous pourrez vous connecter dès qu&apos;il sera validé.</p>
          </div>
        </div>
        {backLink}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="gf-card relative w-full max-w-md space-y-4 p-8" style={CARD_STYLE}>
      {header}
      <p className="text-sm text-zinc-500">
        Réservé aux membres de l&apos;équipe. Votre compte sera activé après validation par un administrateur.
      </p>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
        <input required maxLength={150} autoComplete="name" value={form.fullName} onChange={set("fullName")} className={INPUT} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            required
            maxLength={150}
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className={INPUT}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Téléphone</label>
          <input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={set("phone")} className={INPUT} dir="ltr" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Confirmer le mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
            className={INPUT}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-400">8 caractères minimum.</p>

      {/* Champ piège invisible : rempli seulement par les robots. */}
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: -10000, width: 1, height: 1, overflow: "hidden" }}>
        <input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={set("website")} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="gf-btn-primary w-full disabled:opacity-60">
        {submitting ? "Envoi..." : "Envoyer la demande"}
      </button>

      {backLink}
    </form>
  );
}
