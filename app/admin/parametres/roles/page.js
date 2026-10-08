import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission, getPermissionsMatrix } from "@/lib/permissions";
import RolesManager from "./RolesManager";
import PageHeader from "../../_components/PageHeader";

export default async function RolesPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    redirect("/admin/parametres");
  }

  const { roles, permissions, grantedKeys } = await getPermissionsMatrix();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="admin_panel_settings"
        title="Rôles & permissions"
        description={
          <>
            Le rôle direction garde toujours un accès complet, quelle que soit
            cette matrice — filet de sécurité pour ne jamais se retrouver
            bloqué hors du système.
          </>
        }
      />

      <RolesManager
        roles={roles}
        permissions={permissions}
        initialGrantedKeys={grantedKeys}
      />
    </div>
  );
}
