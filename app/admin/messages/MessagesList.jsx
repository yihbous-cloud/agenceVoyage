"use client";

import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

export default function MessagesList({ initialMessages, canManage }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  const toggleStatus = async (msg) => {
    const nextStatus = msg.status === "traite" ? "nouveau" : "traite";
    await fetch(`/api/admin/contact-messages/${msg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Supprimer ce message ?"))) return;
    await fetch(`/api/admin/contact-messages/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {initialMessages.map((msg) => (
        <div
          key={msg.id}
          className="rounded-xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-zinc-900">
                {msg.full_name}{" "}
                <span className="font-normal text-zinc-500">— {msg.email}</span>
              </p>
              {msg.phone && <p className="text-sm text-zinc-500">{msg.phone}</p>}
              {msg.subject && (
                <p className="mt-1 text-sm font-medium text-zinc-700">
                  {msg.subject}
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                msg.status === "traite"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {msg.status === "traite" ? "Traité" : "Nouveau"}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-zinc-700">
            {msg.message}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            {new Date(msg.created_at).toLocaleString("fr-FR")}
          </p>
          {canManage && (
            <div className="mt-3 flex gap-4 text-sm">
              <button
                onClick={() => toggleStatus(msg)}
                className="text-emerald-700 hover:underline"
              >
                Marquer comme {msg.status === "traite" ? "nouveau" : "traité"}
              </button>
              <button
                onClick={() => handleDelete(msg.id)}
                className="text-red-600 hover:underline"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      ))}
      {initialMessages.length === 0 && (
        <p className="text-sm text-zinc-500">Aucun message.</p>
      )}
      {confirmDialog}
    </div>
  );
}
