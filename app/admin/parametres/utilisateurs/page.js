import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission, listRoles } from "@/lib/permissions";
import { listStaffUsers } from "@/lib/staffUsers";
import UtilisateursManager from "./UtilisateursManager";
import PageHeader from "../../_components/PageHeader";

export default async function UtilisateursPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    redirect("/admin/parametres");
  }

  const [users, roles] = await Promise.all([listStaffUsers(), listRoles()]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="manage_accounts"
        title="Utilisateurs"
        description={<>Comptes internes de l&apos;équipe et rôle assigné à chacun.</>}
      />

      <UtilisateursManager initialUsers={users} roles={roles} currentUserId={session.id} />
    </div>
  );
}
