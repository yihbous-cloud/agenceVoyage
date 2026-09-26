"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

const BUILT_IN_ROLES = ["direction", "ventes", "comptabilite", "suivi"];

function groupByCategory(permissions) {
  const groups = new Map();
  for (const p of permissions) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category).push(p);
  }
  return [...groups.entries()];
}

export default function RolesManager({ roles, permissions, initialGrantedKeys }) {
  const router = useRouter();
  const [grantedKeys, setGrantedKeys] = useState(() => new Set(initialGrantedKeys));
  const [dirty, setDirty] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const grouped = useMemo(() => groupByCategory(permissions), [permissions]);

  const toggle = (roleId, code) => {
    const key = `${roleId}:${code}`;
    setGrantedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await Promise.all(
        roles
          .filter((r) => r.name !== "direction")
          .map((r) => {
            const codes = permissions
              .map((p) => p.code)
              .filter((code) => grantedKeys.has(`${r.id}:${code}`));
            return fetch(`/api/admin/roles/${r.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ permissionCodes: codes }),
            }).then(async (res) => {
              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || `Erreur pour le rôle ${r.name}`);
              }
            });
          })
      );
      setDirty(false);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName, description: newRoleDescription }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la création du rôle");
      }
      setNewRoleName("");
      setNewRoleDescription("");
      setShowNewRole(false);
      router.refresh();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!(await confirm(`Supprimer le rôle "${role.name}" ?`))) return;
    const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
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
              <th className="sticky left-0 bg-white px-4 py-3">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="px-4 py-3 text-center capitalize">
                  <div className="flex flex-col items-center gap-1">
                    {r.name}
                    {!BUILT_IN_ROLES.includes(r.name) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r)}
                        className="text-xs font-normal text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([category, perms]) => (
              <Fragment key={category}>
                <tr className="bg-zinc-50">
                  <td
                    colSpan={roles.length + 1}
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {category}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.code} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{p.label}</td>
                    {roles.map((r) => {
                      const isDirection = r.name === "direction";
                      const checked = isDirection || grantedKeys.has(`${r.id}:${p.code}`);
                      return (
                        <td key={r.id} className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isDirection}
                            onChange={() => toggle(r.id, p.code)}
                            className="h-4 w-4 rounded border-zinc-300 disabled:opacity-50"
                            title={isDirection ? "Toujours actif (rôle direction)" : undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
        {success && <span className="text-sm text-emerald-700">Permissions enregistrées.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {showNewRole ? (
        <form
          onSubmit={handleCreateRole}
          className="flex max-w-xl flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-zinc-700">Nom du rôle</label>
            <input
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="ex : marketing"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-zinc-700">Description</label>
            <input
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => setShowNewRole(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Annuler
          </button>
          {createError && <p className="w-full text-sm text-red-600">{createError}</p>}
        </form>
      ) : (
        <button
          onClick={() => setShowNewRole(true)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Nouveau rôle
        </button>
      )}
      {confirmDialog}
    </div>
  );
}
