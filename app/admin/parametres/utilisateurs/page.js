import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission, listRoles } from "@/lib/permissions";
import { listStaffUsers } from "@/lib/staffUsers";
import UtilisateursManager from "./UtilisateursManager";
import SignupRequests from "./SignupRequests";
import PageHeader from "../../_components/PageHeader";

export default async function UtilisateursPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    redirect("/admin/parametres");
  }

  const [allUsers, roles] = await Promise.all([listStaffUsers(), listRoles()]);
  // Demandes de compte (migration 041) : en attente d'abord, puis refusées ;
  // la liste principale ne montre que les comptes validés.
  const requests = allUsers
    .filter((u) => u.approval_status !== "valide")
    .sort((a, b) => (a.approval_status === b.approval_status ? 0 : a.approval_status === "en_attente" ? -1 : 1));
  const users = allUsers.filter((u) => u.approval_status === "valide");
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon="manage_accounts"
        title="Utilisateurs"
        description={<>Comptes internes de l&apos;équipe et rôle assigné à chacun.</>}
      />

      {requests.length > 0 && <SignupRequests requests={requests} roles={roleOptions} />}

      <UtilisateursManager initialUsers={users} roles={roles} currentUserId={session.id} />
    </div>
  );
}
