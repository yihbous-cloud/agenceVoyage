import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getBusinessHours, listSlaRules, listEscortsForUpcomingTrips, listActiveStaff, listQuickReplies, listTeams } from "@/lib/whatsapp/team";
import PageHeader from "../../_components/PageHeader";
import TeamManager from "./TeamManager";

export const dynamic = "force-dynamic";

// Horaires, délais de prise en charge, accompagnateurs, réponses rapides (8.13, 8.15).
export default async function TeamPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.team"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [schedule, sla, trips, staff, quickReplies, teams] = await Promise.all([
    getBusinessHours(),
    listSlaRules(),
    listEscortsForUpcomingTrips(),
    listActiveStaff(),
    listQuickReplies(),
    listTeams(),
  ]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="support_agent"
        title="Équipe, horaires et délais"
        description="Organisation du traitement humain des conversations WhatsApp. Les équipes correspondent aux rôles (Paramètres › Rôles & permissions)."
      />
      <TeamManager
        initial={JSON.parse(JSON.stringify({ schedule, sla, trips, staff, quickReplies, teams: teams.map((t) => t.name) }))}
      />
    </div>
  );
}
