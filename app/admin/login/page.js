"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminLocale } from "../_components/AdminLocale";

function LoginForm() {
  const { brandName } = useAdminLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, totp: needTotp ? totp : undefined }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.mfaRequired) setNeedTotp(true);
      if (!res.ok) throw new Error(data.message || "Connexion impossible");
      if (data.mfaRequired) return; // le code est demandé

      // Rôle soumis à la double authentification sans l'avoir activée : la
      // page de sécurité est la seule accessible tant qu'elle n'est pas faite.
      const next = data.mfaSetupRequired ? "/admin/securite" : searchParams.get("next") || "/admin";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="gf-card w-full max-w-sm space-y-4 p-8"
      style={{ boxShadow: "0 30px 80px -30px rgba(16,16,20,.25)" }}
    >
      <div className="flex items-center gap-3 pb-2">
        <span className="gf-logo" style={{ width: 40, height: 40, fontSize: 15 }} translate="no">
          {brandName
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em" }}>Espace interne</h1>
          <p className="text-sm text-zinc-500" translate="no">
            {brandName}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Mot de passe
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
        />
      </div>

      {needTotp && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Code de vérification (application d&apos;authentification)</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={7}
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-center text-lg tracking-[0.4em]"
            dir="ltr"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="gf-btn-primary w-full disabled:opacity-60"
      >
        {submitting ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
