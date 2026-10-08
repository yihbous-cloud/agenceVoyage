import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTestCases, listTestRuns } from "@/lib/ai/sandbox";
import { listSettingsVersions } from "@/lib/ai/settings";
import { isAiConfigured } from "@/lib/ai/client";
import { query } from "@/lib/db";
import PageHeader from "../../_components/PageHeader";
import SandboxView from "./SandboxView";

export const dynamic = "force-dynamic";

// Bac à sable de l'agent IA (exigence 8.10) : simulation, rien n'est envoyé.
export default async function SandboxPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "ia.sandbox"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [cases, runs, versions, travelers] = await Promise.all([
    listTestCases(),
    listTestRuns(),
    listSettingsVersions(),
    // Voyageurs inscrits récents, pour simuler un client "inscrit".
    query(
      `SELECT DISTINCT tr.id, tr.full_name FROM travelers tr
       JOIN registrations r ON r.traveler_id = tr.id AND r.agency_id = tr.agency_id
       WHERE tr.agency_id = ? AND r.status <> 'annule' ORDER BY tr.id DESC LIMIT 100`,
      [session.agencyId]
    ),
  ]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="science"
        title="Bac à sable de l'agent IA"
        description="Discutez avec l'agent comme un client : les outils sont exécutés en lecture, les transferts, tâches et envois sont seulement simulés. Chaque essai est facturé par l'API Claude."
      />
      <SandboxView
        aiConfigured={isAiConfigured()}
        initialCases={JSON.parse(JSON.stringify(cases))}
        initialRuns={JSON.parse(JSON.stringify(runs))}
        versions={JSON.parse(JSON.stringify(versions))}
        travelers={travelers}
      />
    </div>
  );
}
