import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAuthors } from "@/lib/authors";
import { listStaffUsers } from "@/lib/staffUsers";
import PageHeader from "../../_components/PageHeader";
import AuthorsManager from "./AuthorsManager";

export const dynamic = "force-dynamic";

// Auteurs et relecteurs des guides (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies) : rôle, expérience et référent religieux affichés
// sur chaque guide.
export default async function AuthorsPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "contenus.manage"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [authors, staff] = await Promise.all([listAuthors(), listStaffUsers().catch(() => [])]);
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon="history_edu"
        title="Auteurs"
        description="Personnes qui rédigent ou relisent les guides. Leur rôle et leur expérience sont affichés sur le site ; seul un référent religieux peut relire un guide religieux."
      />
      <AuthorsManager
        initialAuthors={JSON.parse(JSON.stringify(authors))}
        staff={staff.filter((s) => s.approval_status === undefined || s.approval_status === "valide").map((s) => ({ id: s.id, name: s.full_name }))}
      />
    </div>
  );
}
