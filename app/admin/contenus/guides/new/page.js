import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAuthors } from "@/lib/authors";
import { listAllPrograms } from "@/lib/programsAdmin";
import PageHeader from "../../../_components/PageHeader";
import GuideForm from "../GuideForm";

export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  const session = await getSession();
  if (!(await hasPermission(session, "contenus.manage"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [authors, programs] = await Promise.all([listAuthors(), listAllPrograms()]);
  return (
    <div className="space-y-6">
      <PageHeader icon="article" title="Nouveau guide" />
      <GuideForm
        authors={authors.filter((a) => a.is_active).map((a) => ({ id: a.id, name: a.name, is_religious_referent: Boolean(a.is_religious_referent) }))}
        programs={programs.map((p) => ({ id: p.id, title: p.title }))}
      />
    </div>
  );
}
