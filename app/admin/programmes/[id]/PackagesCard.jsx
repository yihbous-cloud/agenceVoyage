"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Carte « Formules et réductions » (migration 042) : prix du billet seul du
// voyage (sert à « Vol seul » et à « Hébergement seul » = prix complet −
// billet) et, pour l'administrateur seulement, le plafond de réduction en MAD
// par voyageur. discountCap n'est jamais transmis à un autre rôle.
export default function PackagesCard({ tripId, priceFlightOnly, canManage, canAdminDiscount, discountCap, onSuccess }) {
  const router = useRouter();
  const [flight, setFlight] = useState(priceFlightOnly ?? "");
  const [cap, setCap] = useState(discountCap ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!tripId) return <p className="text-sm text-zinc-500">Aucun voyage pour ce programme.</p>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {};
    if (canManage) body.priceFlightOnly = flight === "" ? null : Number(flight);
    if (canAdminDiscount) body.discountCap = cap === "" ? null : Number(cap);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Prix du billet seul (MAD par personne)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={!canManage}
          value={flight}
          onChange={(e) => setFlight(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Formule « Vol seul » = ce prix. Formule « Hébergement seul (sans billet) » = prix du programme complet − ce prix.
        </p>
      </div>

      {canAdminDiscount && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <label className="block text-sm font-medium text-zinc-700">
            Plafond de réduction par voyageur (MAD)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-zinc-600">
            Visible par l&apos;administrateur seulement. L&apos;équipe peut accorder une réduction jusqu&apos;à ce
            montant ; au-delà, et pour toute gratuité, l&apos;accord de l&apos;administrateur est obligatoire. Vide =
            réductions réservées à l&apos;administrateur.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {(canManage || canAdminDiscount) && (
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
