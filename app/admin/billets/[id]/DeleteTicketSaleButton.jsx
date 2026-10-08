"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../_components/Icon";
import { useConfirm } from "../../_components/useConfirm";

// Suppression d'une vente — refusée par le serveur dès qu'un versement
// existe (on annule la vente et on rembourse plutôt qu'effacer l'historique).
export default function DeleteTicketSaleButton({ saleId, hasPayments }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [error, setError] = useState(null);

  if (hasPayments) return null;

  const handleDelete = async () => {
    if (!(await confirm("Supprimer cette vente de billet ?"))) return;
    const res = await fetch(`/api/admin/ticket-sales/${saleId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
      return;
    }
    router.push("/admin/billets");
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={handleDelete} className="gf-btn-icon gf-danger" title="Supprimer cette vente">
        <Icon name="delete" size={18} />
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {confirmDialog}
    </>
  );
}
