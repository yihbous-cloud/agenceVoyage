"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "name", label: "Nom de l'agence", required: true, span: 2 },
  { key: "address", label: "Adresse", span: 2 },
  { key: "city", label: "Ville" },
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "website", label: "Site web", span: 2 },
  { key: "rc", label: "RC (Registre de commerce)" },
  { key: "taxId", label: "IF (Identifiant fiscal)", dataKey: "tax_id" },
  { key: "ice", label: "ICE" },
  { key: "footerNote", label: "Note de bas de reçu", dataKey: "footer_note", span: 2 },
];

function toFormState(settings) {
  const state = {};
  for (const field of FIELDS) {
    const dbKey = field.dataKey || field.key;
    state[field.key] = settings?.[dbKey] || "";
  }
  return state;
}

export default function AgencySettingsForm({ settings, canEdit }) {
  const router = useRouter();
  const [values, setValues] = useState(() => toFormState(settings));
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/agency-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      setSuccess(true);
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
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      {!canEdit && (
        <p className="text-xs text-zinc-400">
          Lecture seule — réservé au rôle direction.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key} className={field.span === 2 ? "col-span-2" : ""}>
            <label className="block text-sm font-medium text-zinc-700">
              {field.label}
            </label>
            <input
              required={field.required}
              disabled={!canEdit}
              value={values[field.key]}
              onChange={handleChange(field.key)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">Paramètres enregistrés.</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
