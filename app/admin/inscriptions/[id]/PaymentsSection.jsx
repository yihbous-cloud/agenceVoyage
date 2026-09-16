"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PAYMENT_METHODS = ["especes", "virement", "cheque", "carte", "autre"];

export default function PaymentsSection({ registrationId, payments, totalDue, role }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("especes");
  const [receiptReference, setReceiptReference] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = ["direction", "comptabilite"].includes(role);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(totalDue) - totalPaid;

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          paymentMethod: method,
          receiptReference: receiptReference || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      setAmount("");
      setReceiptReference("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce paiement ?")) return;
    await fetch(`/api/admin/payments/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Paiements</h2>

      <div className="mt-3 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-zinc-500">Montant dû</p>
          <p className="text-lg font-bold text-zinc-900">{totalDue} MAD</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Payé</p>
          <p className="text-lg font-bold text-emerald-700">{totalPaid} MAD</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Solde</p>
          <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {balance} MAD
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {new Date(p.payment_date).toLocaleDateString("fr-FR")} —{" "}
              <span className="capitalize">{p.payment_method}</span>
              {p.receipt_reference && ` (${p.receipt_reference})`}
              {p.recorded_by_name && (
                <span className="text-zinc-400"> · saisi par {p.recorded_by_name}</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-900">{p.amount} {p.currency}</span>
              <a
                href={`/api/admin/payments/${p.id}/recu`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:underline"
              >
                Reçu
              </a>
              {canManage && (
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>
          </li>
        ))}
        {payments.length === 0 && (
          <li className="py-2 text-sm text-zinc-500">Aucun paiement enregistré.</li>
        )}
      </ul>

      {canManage && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <div className="w-32">
            <label className="block text-sm font-medium text-zinc-700">Montant</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Mode</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-zinc-700">Référence reçu</label>
            <input
              value={receiptReference}
              onChange={(e) => setReceiptReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Enregistrer le paiement
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
