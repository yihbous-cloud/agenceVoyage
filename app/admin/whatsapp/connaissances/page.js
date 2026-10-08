import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listKnowledge, listUnanswered, KNOWLEDGE_CATEGORIES } from "@/lib/ai/knowledge";
import PageHeader from "../../_components/PageHeader";
import KnowledgeManager from "./KnowledgeManager";

export const dynamic = "force-dynamic";

// Base de connaissances de l'agent (exigence 8.9) : ce que l'IA sait, hors
// prix et dates (qui viennent du CRM).
export default async function KnowledgePage() {
  const session = await getSession();
  if (!(await hasPermission(session, "ia.knowledge"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [items, unanswered] = await Promise.all([listKnowledge(), listUnanswered()]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="menu_book"
        title="Base de connaissances"
        description="Fiches question / réponse utilisées par l'assistant WhatsApp. Seules les fiches publiées sont connues de l'IA. Ne jamais y mettre de prix ni de dates."
      />
      <KnowledgeManager initialItems={JSON.parse(JSON.stringify(items))} initialUnanswered={JSON.parse(JSON.stringify(unanswered))} categories={KNOWLEDGE_CATEGORIES} />
    </div>
  );
}
