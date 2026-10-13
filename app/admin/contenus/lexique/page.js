import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllTerms } from "@/lib/glossary";
import PageHeader from "../../_components/PageHeader";
import GlossaryManager from "./GlossaryManager";

export const dynamic = "force-dynamic";

// Lexique bilingue (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies), publié sous /guide/lexique.
export default async function GlossaryAdminPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "contenus.manage"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const terms = await listAllTerms();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon="translate"
        title="Lexique"
        description="Les mots de la Omra, du Hajj et du voyage, définis simplement en français et en arabe. Publié sur /guide/lexique ; un terme n'apparaît que dans les langues où il est défini."
      />
      <GlossaryManager initialTerms={JSON.parse(JSON.stringify(terms))} />
    </div>
  );
}
