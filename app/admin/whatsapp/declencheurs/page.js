import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTriggers, FAMILIES, EVENT_TYPES, STOP_CONDITIONS, INTERNAL_ACTIONS } from "@/lib/whatsapp/triggers";
import { listTemplates } from "@/lib/whatsapp/templates";
import { listTeams } from "@/lib/whatsapp/team";
import { query } from "@/lib/db";
import PageHeader from "../../_components/PageHeader";
import TriggersManager from "./TriggersManager";

export const dynamic = "force-dynamic";

// Déclencheurs automatiques (écran 8.12, DC-01 à DC-10).
export default async function TriggersPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.triggers"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [triggers, templates, teams, trips] = await Promise.all([
    listTriggers(),
    listTemplates(),
    listTeams(),
    query(
      `SELECT t.id, t.departure_date, p.title FROM trips t JOIN programs p ON p.id = t.program_id AND p.agency_id = t.agency_id
       WHERE t.agency_id = ? AND t.return_date >= CURDATE() AND t.status <> 'annule' ORDER BY t.departure_date`,
      [session.agencyId]
    ),
  ]);
  const templateNames = [...new Map(templates.map((t) => [t.name, { name: t.name, approved: templates.some((x) => x.name === t.name && x.status === "APPROVED"), category: t.category || t.category_requested }])).values()];
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="bolt"
        title="Déclencheurs automatiques"
        description="Messages envoyés automatiquement au fil du parcours client. Si la fenêtre de 24h est ouverte, le message part en texte libre (gratuit) ; sinon le template approuvé dans la langue du client. Aucun envoi entre 21h et 9h ni le vendredi de 12h à 14h, sauf urgence."
      />
      <TriggersManager
        initialTriggers={JSON.parse(JSON.stringify(triggers))}
        templates={templateNames}
        teams={teams.map((t) => t.name)}
        trips={JSON.parse(JSON.stringify(trips))}
        families={FAMILIES}
        events={EVENT_TYPES}
        stops={STOP_CONDITIONS}
        internalActions={INTERNAL_ACTIONS}
      />
    </div>
  );
}
