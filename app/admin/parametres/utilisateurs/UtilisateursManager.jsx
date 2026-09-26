"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

const emptyForm = { fullName: "", email: "", phone: "", password: "", roleId: "", isActive: true };

function UserForm({ initial, roles, onCancel, onSaved, submitLabel, isPasswordRequired }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    const value = key === "isActive" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSaved(form);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
        <input
          required
          value={form.fullName}
          onChange={set("fullName")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={set("email")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Téléphone</label>
        <input
          value={form.phone}
          onChange={set("phone")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Rôle</label>
        <select
          required
          disabled={form.roleLocked}
          value={form.roleId}
          onChange={set("roleId")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        >
          <option value="" disabled>
            Sélectionner...
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {form.roleLocked && (
          <p className="mt-1 text-xs text-zinc-400">
            Vous ne pouvez pas modifier votre propre rôle.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          {isPasswordRequired ? "Mot de passe" : "Nouveau mot de passe"}
        </label>
        <input
          type="password"
          required={isPasswordRequired}
          minLength={8}
          placeholder={isPasswordRequired ? "" : "Laisser vide pour ne pas changer"}
          value={form.password}
          onChange={set("password")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            disabled={form.activeLocked}
            checked={form.isActive}
            onChange={set("isActive")}
            className="h-4 w-4 rounded border-zinc-300 disabled:opacity-60"
          />
          Compte actif
          {form.activeLocked && (
            <span className="text-xs text-zinc-400">(votre propre compte)</span>
          )}
        </label>
      </div>

      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

      <div className="col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export default function UtilisateursManager({ initialUsers, roles, currentUserId }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const handleCreate = async (form) => {
    const res = await fetch("/api/admin/staff-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Erreur lors de la création");
    }
    setShowCreate(false);
  };

  const handleUpdate = (id) => async (form) => {
    const res = await fetch(`/api/admin/staff-users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Erreur lors de la mise à jour");
    }
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Supprimer ce compte ?"))) return;
    const res = await fetch(`/api/admin/staff-users/${id}`, { method: "DELETE" });
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
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {u.full_name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-zinc-400">(vous)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{u.role_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        u.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {u.is_active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                      className="text-emerald-700 hover:underline"
                    >
                      {editingId === u.id ? "Fermer" : "Modifier"}
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="ml-3 text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
                {editingId === u.id && (
                  <tr>
                    <td colSpan={6} className="bg-zinc-50 px-4 py-4">
                      <UserForm
                        initial={{
                          fullName: u.full_name,
                          email: u.email,
                          phone: u.phone || "",
                          password: "",
                          roleId: String(u.role_id),
                          isActive: !!u.is_active,
                          roleLocked: u.id === currentUserId,
                          activeLocked: u.id === currentUserId,
                        }}
                        roles={roles}
                        onCancel={() => setEditingId(null)}
                        onSaved={handleUpdate(u.id)}
                        submitLabel="Enregistrer"
                        isPasswordRequired={false}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {initialUsers.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <UserForm
          initial={emptyForm}
          roles={roles}
          onCancel={() => setShowCreate(false)}
          onSaved={handleCreate}
          submitLabel="Créer le compte"
          isPasswordRequired
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Nouvel utilisateur
        </button>
      )}
      {confirmDialog}
    </div>
  );
}
