"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AIRLINES, getIataByName, getNameByIata } from "@/lib/airlinesReference";

const TEMPLATE_KEYS = [
  "ram_template",
  "saudia_template",
  "turkish_template",
  "generic_template",
];

export default function AirlinesManager({ initialAirlines, canManage }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [iataCode, setIataCode] = useState("");
  const [exportTemplateKey, setExportTemplateKey] = useState("generic_template");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Sélectionner un nom/code connu remplit automatiquement l'autre champ
  // (compagnie absente de la liste : saisie libre, aucun remplissage).
  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    const matchedIata = getIataByName(value);
    if (matchedIata) setIataCode(matchedIata);
  };

  const handleIataChange = (e) => {
    const value = e.target.value.toUpperCase();
    setIataCode(value);
    const matchedName = getNameByIata(value);
    if (matchedName) setName(matchedName);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/airlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, iataCode: iataCode || null, exportTemplateKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la création");
      }
      setName("");
      setIataCode("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette compagnie ?")) return;
    const res = await fetch(`/api/admin/airlines/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Code IATA</th>
              <th className="px-4 py-3">Gabarit d&apos;export</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {initialAirlines.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{a.name}</td>
                <td className="px-4 py-3 text-zinc-600">{a.iata_code || "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{a.export_template_key}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {initialAirlines.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={4}>
                  Aucune compagnie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form
          onSubmit={handleCreate}
          className="flex max-w-2xl flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-zinc-700">Nom</label>
            <input
              required
              list="airline-names"
              value={name}
              onChange={handleNameChange}
              placeholder="Taper pour rechercher..."
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <datalist id="airline-names">
              {AIRLINES.map((a) => (
                <option key={a.iata} value={a.name} />
              ))}
            </datalist>
          </div>
          <div className="w-28">
            <label className="block text-sm font-medium text-zinc-700">IATA</label>
            <input
              list="airline-iata-codes"
              maxLength={3}
              value={iataCode}
              onChange={handleIataChange}
              placeholder="ex : AT"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <datalist id="airline-iata-codes">
              {AIRLINES.map((a) => (
                <option key={a.iata} value={a.iata}>
                  {a.name}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Gabarit</label>
            <select
              value={exportTemplateKey}
              onChange={(e) => setExportTemplateKey(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {TEMPLATE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Ajouter
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
