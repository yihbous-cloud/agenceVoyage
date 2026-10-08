"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Responsable/point de contact du groupe — le premier membre inscrit le
// devient automatiquement (lib/registrationGroups.js::ensureGroupResponsible,
// voir CLAUDE.md), modifiable ensuite ici parmi les membres actuels.
export default function GroupResponsibleForm({ groupId, members, responsibleRegistrationId, role }) {
  const router = useRouter();
  const [value, setValue] = useState(responsibleRegistrationId ? String(responsibleRegistrationId) : "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = ["direction", "ventes"].includes(role);

  const handleChange = async (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/responsible`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleRegistrationId: newValue || null }),
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
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">Responsable :</span>
      <select
        disabled={!canEdit || submitting}
        value={value}
        onChange={handleChange}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-100"
      >
        <option value="">Aucun</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
