import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission, getPermissionsMatrix } from "@/lib/permissions";
import RolesManager from "./RolesManager";

export default async function RolesPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    redirect("/admin/parametres");
  }

  const { roles, permissions, grantedKeys } = await getPermissionsMatrix();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Rôles & permissions</h1>
        <p className="text-sm text-zinc-500">
          Le rôle direction garde toujours un accès complet, quelle que soit
          cette matrice — filet de sécurité pour ne jamais se retrouver
          bloqué hors du système.
        </p>
      </div>

      <RolesManager
        roles={roles}
        permissions={permissions}
        initialGrantedKeys={grantedKeys}
      />
    </div>
  );
}
