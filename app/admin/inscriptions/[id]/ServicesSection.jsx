"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ServicesSection({
  registrationId,
  catalogServices,
  registrationServices,
  flightTicketPrice,
  canManage,
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const total = registrationServices.reduce((sum, s) => sum + Number(s.amount), 0);

  const handleServiceChange = (e) => {
    const id = e.target.value;
    setServiceId(id);
    const service = catalogServices.find((s) => String(s.id) === id);
    if (service?.name.toLowerCase().includes("avion") && flightTicketPrice != null) {
      setAmount(flightTicketPrice);
    } else if (service?.default_price != null) {
      setAmount(service.default_price);
    } else {
      setAmount("");
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!serviceId || amount === "") return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, amount: Number(amount) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur");
      }
      setServiceId("");
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id) => {
    await fetch(`/api/admin/registration-services/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Services facturés</h2>

      <ul className="mt-3 divide-y divide-zinc-100">
        {registrationServices.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span>{s.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-900">{s.amount} MAD</span>
              {canManage && (
                <button
                  onClick={() => handleRemove(s.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              )}
            </div>
          </li>
        ))}
        {registrationServices.length === 0 && (
          <li className="py-2 text-sm text-zinc-500">Aucun service ajouté.</li>
        )}
      </ul>

      {registrationServices.length > 0 && (
        <p className="mt-2 text-right text-sm font-semibold text-zinc-900">
          Total : {total} MAD
        </p>
      )}

      {canManage && (
        <form onSubmit={handleAdd} className="mt-4 flex items-end gap-3 border-t border-zinc-100 pt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700">Service</label>
            <select
              value={serviceId}
              onChange={handleServiceChange}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Sélectionner...</option>
              {catalogServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-zinc-700">Montant</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
