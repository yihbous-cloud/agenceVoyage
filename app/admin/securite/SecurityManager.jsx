"use client";

import { useEffect, useState } from "react";
import Icon from "../_components/Icon";

export default function SecurityManager({ mustSetup }) {
  const [state, setState] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/security");
    if (res.ok) setState(await res.json());
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/security")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => alive && data && setState(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function post(body) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.message || "Action impossible" });
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <div className="gf-card p-5 text-sm text-zinc-500">Chargement...</div>;

  return (
    <div className="space-y-4">
      {mustSetup && !state.enabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          La double authentification est obligatoire pour votre rôle. Activez-la pour accéder à l&apos;espace interne.
        </div>
      )}
      <div className="gf-card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Icon name={state.enabled ? "verified" : "lock"} size={22} className={state.enabled ? "text-emerald-600" : "text-zinc-400"} />
          <div>
            <p className="font-medium">{state.enabled ? "Double authentification active" : "Double authentification non activée"}</p>
            {state.required && <p className="text-xs text-zinc-500">Obligatoire pour votre rôle.</p>}
          </div>
        </div>

        {!state.enabled && !setup && (
          <button
            type="button"
            className="gf-btn-primary"
            disabled={busy}
            onClick={async () => {
              const data = await post({ action: "start" });
              if (data) setSetup(data);
            }}
          >
            <Icon name="key" size={16} />
            Activer la double authentification
          </button>
        )}

        {!state.enabled && setup && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = await post({ action: "confirm", code });
              if (data) {
                setSetup(null);
                setCode("");
                setMessage({ ok: true, text: "Double authentification activée." });
                // Rechargement complet : la nouvelle session (cookie) lève la restriction.
                if (mustSetup) window.location.assign(new URL("/admin", window.location.origin).href);
                else load();
              }
            }}
          >
            <p className="text-sm">1. Scannez ce code QR avec votre application d&apos;authentification.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Code QR de double authentification" width={220} height={220} className="rounded border" />
            <p className="text-xs text-zinc-500">
              Ou saisissez la clé à la main : <span className="font-mono" translate="no" dir="ltr">{setup.secret}</span>
            </p>
            <label className="block text-sm">
              2. Saisissez le code à 6 chiffres affiché par l&apos;application
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-40 rounded-md border px-3 py-2 text-center text-lg tracking-[0.3em]"
                dir="ltr"
              />
            </label>
            <button type="submit" className="gf-btn-primary" disabled={busy}>
              Confirmer
            </button>
          </form>
        )}

        {state.enabled && !state.required && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post({ action: "disable", code })) {
                setCode("");
                setMessage({ ok: true, text: "Double authentification désactivée." });
                load();
              }
            }}
          >
            <label className="text-sm">
              Code actuel pour désactiver
              <input required inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-40 rounded-md border px-3 py-2 text-center" dir="ltr" />
            </label>
            <button type="submit" className="gf-btn-outline" disabled={busy}>
              Désactiver
            </button>
          </form>
        )}

        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
      </div>
      <p className="text-xs text-zinc-500">
        Téléphone perdu ? Un administrateur peut réinitialiser votre double authentification depuis la page Utilisateurs ; vous la réactiverez à la connexion suivante.
      </p>
    </div>
  );
}
