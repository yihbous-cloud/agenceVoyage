"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import Icon from "@/app/admin/_components/Icon";
import { roleLabel } from "@/app/admin/_components/statusStyles";

// Demandes de compte faites depuis /admin/demande-compte (migration 041) :
// le demandeur ne choisit pas de rôle — l'administrateur le choisit ici puis valide (le compte devient
// actif), ou refuse (le compte reste inactif, la personne voit « demande
// refusée » à la connexion). Une demande refusée peut encore être validée.
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });
}

function RequestRow({ request, roles, onConfirm }) {
  const router = useRouter();
  // Vide au départ : le rôle stocké sur une demande n'est qu'un rôle d'attente.
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const pending = request.approval_status === "en_attente";

  const review = async (decision) => {
    const role = roles.find((r) => String(r.id) === roleId);
    if (decision === "valider" && !role) {
      setError("Choisissez le rôle du compte");
      return;
    }
    const question =
      decision === "valider"
        ? `Valider le compte de ${request.full_name} avec le rôle « ${roleLabel(role?.name)} » ? Il pourra se connecter immédiatement.`
        : `Refuser la demande de compte de ${request.full_name} ?`;
    if (!(await onConfirm(question))) return;
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/staff-users/${request.id}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, roleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'enregistrement");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await onConfirm(`Supprimer définitivement la demande de ${request.full_name} ?`))) return;
    setBusy("supprimer");
    setError(null);
    const res = await fetch(`/api/admin/staff-users/${request.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
    }
    setBusy(null);
  };

  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 py-4">
      <div className="min-w-[220px] flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">{request.full_name}</span>
          {pending ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Icon name="hourglass_top" size={14} />
              En attente
            </span>
          ) : (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Refusée</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span dir="ltr">{request.email}</span>
          {request.phone && <span dir="ltr">{request.phone}</span>}
          <span>
            <span>Demandé le</span> <span dir="ltr">{formatDate(request.created_at)}</span>
          </span>
          {!pending && request.reviewer_name && (
            <span>
              <span>Refusée par</span> <span translate="no">{request.reviewer_name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setError(null);
          }}
          className="h-9 rounded-lg border border-zinc-300 px-2 text-sm"
          aria-label="Rôle attribué"
          title="Rôle attribué"
        >
          <option value="" disabled>
            Choisir le rôle...
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {roleLabel(r.name)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => review("valider")}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <Icon name="how_to_reg" size={18} />
          {busy === "valider" ? "Validation..." : "Valider"}
        </button>
        {pending && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => review("refuser")}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            <Icon name="block" size={18} />
            Refuser
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={remove}
          className="px-1 text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          Supprimer
        </button>
      </div>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </li>
  );
}

export default function SignupRequests({ requests, roles }) {
  const [confirm, confirmDialog] = useConfirm();
  const pendingCount = requests.filter((r) => r.approval_status === "en_attente").length;

  return (
    <section className="gf-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <Icon name="person_add" size={20} />
        <h2 className="text-sm font-semibold text-zinc-900">Demandes de compte</h2>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{pendingCount}</span>
        )}
      </div>
      <p className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
        Comptes demandés depuis la page de connexion. Vérifiez l&apos;identité de la personne, choisissez son rôle puis validez.
      </p>
      <ul className="divide-y divide-zinc-100">
        {requests.map((r) => (
          <RequestRow key={r.id} request={r} roles={roles} onConfirm={confirm} />
        ))}
      </ul>
      {confirmDialog}
    </section>
  );
}
