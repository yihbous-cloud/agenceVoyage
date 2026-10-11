"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { useConfirm } from "./useConfirm";
import { useAdminLocale } from "./AdminLocale";

const OPTIONS = [
  { value: "non_demande", label: "Non demandé" },
  { value: "en_cours", label: "En cours" },
  { value: "accorde", label: "Accordé" },
];

// Change le statut visa de tous les voyageurs d'un voyage en un geste.
// Les visas refusés et les inscriptions annulées ne sont jamais modifiés.
export default function BulkVisaButton({ tripId }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function apply(option) {
    setOpen(false);
    const ok = await confirm(
      tr("Passer le visa de tous les voyageurs de ce départ à « {status} » ? Les visas refusés ne sont pas modifiés.", {
        status: tr(option.label),
      })
    );
    if (!ok) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/visa-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visaStatus: option.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      setMessage(
        tr("{count} visa(s) mis à jour", { count: data.updatedCount }) +
          (data.refusedCount > 0 ? ` · ${tr("{count} refusé(s) inchangé(s)", { count: data.refusedCount })}` : "")
      );
      router.refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="gf-btn-outline"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="badge" size={16} />
        {tr("Visa")}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
        >
          <p className="px-2 py-1 text-xs text-zinc-500">{tr("Tous les voyageurs →")}</p>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitem"
              onClick={() => apply(o)}
              className="block w-full rounded px-2 py-1.5 text-start text-sm hover:bg-zinc-100"
            >
              {tr(o.label)}
            </button>
          ))}
        </div>
      )}
      {message && (
        <p className="absolute end-0 top-full z-10 mt-1 whitespace-nowrap text-xs text-emerald-700">{message}</p>
      )}
      {confirmDialog}
    </div>
  );
}
