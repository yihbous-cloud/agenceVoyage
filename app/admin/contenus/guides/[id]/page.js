import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getGuideById } from "@/lib/guides";
import { listAuthors } from "@/lib/authors";
import { listAllPrograms } from "@/lib/programsAdmin";
import { listTranslations, toFormValues } from "@/lib/contentTranslations";
import PageHeader from "../../../_components/PageHeader";
import GuideForm from "../GuideForm";

export const dynamic = "force-dynamic";

export default async function EditGuidePage({ params }) {
  const { id } = await params;
  const session = await getSession();
  if (!(await hasPermission(session, "contenus.manage"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const guide = await getGuideById(id);
  if (!guide) notFound();
  const [authors, programs, translations] = await Promise.all([
    listAuthors(),
    listAllPrograms(),
    listTranslations("guide", [guide.id]),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader icon="article" title={guide.title} titleTranslate="no" />
      <GuideForm
        guide={JSON.parse(JSON.stringify(guide))}
        translations={toFormValues("guide", translations[guide.id])}
        // Un auteur désactivé reste proposé s'il est déjà lié à ce guide.
        authors={authors
          .filter((a) => a.is_active || a.id === guide.author_id || a.id === guide.reviewer_id)
          .map((a) => ({ id: a.id, name: a.name, is_religious_referent: Boolean(a.is_religious_referent) }))}
        programs={programs.map((p) => ({ id: p.id, title: p.title }))}
      />
    </div>
  );
}
