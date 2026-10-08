"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

const PAYMENT_METHODS = ["especes", "virement", "cheque", "carte", "autre"];

// apiBasePath : préfixe des routes API (ex. `/api/admin/registrations/12`
// ou `/api/admin/groups/3`) — permet de réutiliser ce composant tel quel
// pour le suivi financier d'un groupe (voir CLAUDE.md §3quindecies).
// bare : true quand le composant est déjà encapsulé dans une boîte
// (ex. Modal.jsx, voir CLAUDE.md) — retire son propre habillage
// bordure/titre pour ne pas créer une boîte dans la boîte.
export default function PaymentsSection({
  apiBasePath,
  payments,
  totalDue,
  canManage,
  title = "Paiements",
  bare = false,
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("especes");
  // "remboursement" : cas d'un voyageur qui annule le voyage (annulation de
  // paiement, retour d'une avance ou du montant total déjà versé) — un
  // remboursement est enregistré comme un versement au MONTANT NÉGATIF
  // (pas de nouvelle colonne, voir CLAUDE.md), la soustraction du "Payé" et
  // du solde se fait donc automatiquement, sans changement aux rapports
  // financiers existants (déjà un simple SUM(amount)). Le champ "Montant"
  // reste saisi en positif par le personnel — le signe est appliqué à la
  // soumission selon le type choisi.
  const [type, setType] = useState("versement");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRefunded = payments
    .filter((p) => Number(p.amount) < 0)
    .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);
  const balance = Number(totalDue) - totalPaid;
  // Un remboursement suppose qu'il existe un montant net déjà payé à
  // rembourser — sinon "Payé" deviendrait négatif sans qu'aucun versement
  // ne l'explique (bug signalé : remboursement enregistré alors qu'aucun
  // paiement n'existait encore). Option retirée du <select>, pas seulement
  // désactivée, pour ne pas laisser un choix invalide sélectionnable.
  const canRefund = totalPaid > 0;
  const effectiveType = type === "remboursement" && !canRefund ? "versement" : type;

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const signedAmount = effectiveType === "remboursement" ? -Math.abs(Number(amount)) : Number(amount);
      const res = await fetch(`${apiBasePath}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: signedAmount,
          paymentMethod: method,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      setAmount("");
      setType("versement");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Supprimer ce paiement ?"))) return;
    await fetch(`/api/admin/payments/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className={bare ? "" : "rounded-xl border border-zinc-200 bg-white p-6"}>
      {!bare && <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>}

      <div className="mt-3 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-zinc-500">Montant dû</p>
          <p className="text-lg font-bold text-zinc-900">{totalDue} MAD</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Payé</p>
          <p className="text-lg font-bold text-emerald-700">{totalPaid} MAD</p>
          {totalRefunded > 0 && (
            <p className="text-xs text-red-600">dont {totalRefunded} MAD remboursés</p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500">Solde</p>
          <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {balance} MAD
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
        {payments.map((p) => {
          const isRefund = Number(p.amount) < 0;
          return (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {isRefund && (
                <span className="me-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  Remboursement
                </span>
              )}
              {new Date(p.payment_date).toLocaleDateString("fr-FR")} —{" "}
              <span className="capitalize">{p.payment_method}</span>
              {p.receipt_reference && ` (${p.receipt_reference})`}
              {p.recorded_by_name && (
                <span className="text-zinc-400"> · saisi par {p.recorded_by_name}</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className={`font-medium ${isRefund ? "text-red-600" : "text-zinc-900"}`}>
                {isRefund ? "−" : ""}
                {Math.abs(Number(p.amount))} {p.currency}
              </span>
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
          );
        })}
        {payments.length === 0 && (
          <li className="py-2 text-sm text-zinc-500">Aucun paiement enregistré.</li>
        )}
      </ul>

      {canManage && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Type</label>
            <select
              value={effectiveType}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="versement">Versement</option>
              {/* Retirée (pas seulement désactivée) tant qu'aucun montant
                  net n'est payé : rembourser sans versement préalable
                  rendrait "Payé" négatif sans qu'aucun versement ne
                  l'explique — bug signalé sur une inscription réelle. */}
              {canRefund && <option value="remboursement">Remboursement</option>}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-zinc-700">Montant</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
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
          <button
            type="submit"
            disabled={submitting}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              effectiveType === "remboursement"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {submitting
              ? "Enregistrement..."
              : effectiveType === "remboursement"
              ? "Enregistrer le remboursement"
              : "Enregistrer le paiement"}
          </button>
          {/* Cas d'un voyageur qui annule le voyage : retour de l'avance OU
              du montant total déjà versé, en un clic plutôt que de
              recalculer le total payé à la main. */}
          {effectiveType === "remboursement" && (
            <button
              type="button"
              onClick={() => setAmount(String(totalPaid))}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Tout rembourser ({totalPaid} MAD déjà payés)
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {confirmDialog}
    </div>
  );
}
