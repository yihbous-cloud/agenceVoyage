"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Actions des tâches (faite / rouvrir / annuler) et « tout marquer comme lu ».
export default function TaskActions({ id, status, markRead }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(body) {
    setBusy(true);
    try {
      await fetch("/api/admin/whatsapp/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (markRead) {
    return (
      <button type="button" disabled={busy} className="text-xs text-emerald-700 hover:underline" onClick={() => post({ action: "notifications-read", ids: markRead })}>
        Tout marquer comme lu
      </button>
    );
  }
  return status === "ouverte" ? (
    <div className="flex shrink-0 gap-2">
      <button type="button" disabled={busy} className="gf-btn-primary" onClick={() => post({ action: "task-status", id, status: "faite" })}>
        Fait
      </button>
      <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => post({ action: "task-status", id, status: "annulee" })}>
        Annuler
      </button>
    </div>
  ) : (
    <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => post({ action: "task-status", id, status: "ouverte" })}>
      Rouvrir
    </button>
  );
}
