import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission, listRoles } from "@/lib/permissions";
import { listStaffUsers } from "@/lib/staffUsers";
import UtilisateursManager from "./UtilisateursManager";

export default async function UtilisateursPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    redirect("/admin/parametres");
  }

  const [users, roles] = await Promise.all([listStaffUsers(), listRoles()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Utilisateurs</h1>
        <p className="text-sm text-zinc-500">
          Comptes internes de l&apos;équipe et rôle assigné à chacun.
        </p>
      </div>

      <UtilisateursManager initialUsers={users} roles={roles} currentUserId={session.id} />
    </div>
  );
}
