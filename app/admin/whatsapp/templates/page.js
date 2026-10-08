import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTemplates, templateStats } from "@/lib/whatsapp/templates";
import { CRM_FIELDS } from "@/lib/whatsapp/crmContext";
import { query } from "@/lib/db";
import PageHeader from "../../_components/PageHeader";
import TemplatesManager from "./TemplatesManager";

export const dynamic = "force-dynamic";

// Templates Meta (écran 8.11, TP-01 à TP-08).
export default async function TemplatesPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.templates"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const [templates, stats, registrations] = await Promise.all([
    listTemplates(),
    templateStats(),
    // Dossiers récents pour l'aperçu « avec les données d'un vrai client » (TP-06).
    query(
      `SELECT r.id, tr.full_name, p.title FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
       WHERE r.agency_id = ? AND r.status <> 'annule' ORDER BY r.id DESC LIMIT 100`,
      [session.agencyId]
    ),
  ]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="description"
        title="Templates Meta"
        description="Messages pré-approuvés par Meta, seuls envoyables quand la fenêtre de 24h est fermée. Un même nom regroupe les versions française et arabe ; la langue envoyée suit celle du client."
      />
      <TemplatesManager
        initialTemplates={JSON.parse(JSON.stringify(templates))}
        initialStats={JSON.parse(JSON.stringify(stats))}
        fields={CRM_FIELDS}
        registrations={registrations}
      />
    </div>
  );
}
