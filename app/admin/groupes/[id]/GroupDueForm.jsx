"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Montant dû partagé par tout le groupe (pas un montant par membre) — voir
// CLAUDE.md §3quindecies.
export default function GroupDueForm({ groupId, totalDue, canManage }) {
  const router = useRouter();
  const [value, setValue] = useState(totalDue);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalDue: Number(value) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la mise à jour");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Montant dû du groupe (MAD)
        </label>
        <input
          type="number"
          step="0.01"
          disabled={!canManage}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>
      {canManage && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
