import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listCampaigns, listSegments } from "@/lib/whatsapp/campaigns";
import { listTemplates } from "@/lib/whatsapp/templates";
import { listAllPrograms } from "@/lib/programsAdmin";
import { query } from "@/lib/db";
import { resolveAgencyId } from "@/lib/agencyContext";
import PageHeader from "../../_components/PageHeader";
import CampaignsManager from "./CampaignsManager";

export const dynamic = "force-dynamic";

// Campagnes marketing (cahier §8.6, CP-01→06).
export default async function CampaignsPage() {
  const session = await getSession();
  const canPrepare = await hasPermission(session, "whatsapp.campaigns");
  const canApprove = await hasPermission(session, "whatsapp.campaigns.approve");
  if (!canPrepare && !canApprove) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const agencyId = await resolveAgencyId();
  const [campaigns, segments, templates, programs, sources] = await Promise.all([
    listCampaigns(),
    listSegments(),
    listTemplates(),
    listAllPrograms(),
    query(`SELECT DISTINCT source FROM wa_contacts WHERE agency_id = ? AND source IS NOT NULL ORDER BY source`, [agencyId]),
  ]);
  // Une ligne par famille de templates (nom), avec l'état des langues.
  const families = Object.values(
    templates.reduce((acc, t) => {
      const f = (acc[t.name] ||= { name: t.name, category: t.category || t.category_requested, languages: [], approved: false });
      f.languages.push(`${t.language}${t.status === "APPROVED" ? "" : " (non approuvé)"}`);
      if (t.status === "APPROVED") f.approved = true;
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        icon="campaign"
        title="Campagnes"
        description="Envois marketing à un segment de contacts consentants. Circuit : brouillon → à valider → validée par le responsable → envoi progressif par lots, avec arrêt d'urgence."
      />
      <CampaignsManager
        initialCampaigns={JSON.parse(JSON.stringify(campaigns))}
        initialSegments={JSON.parse(JSON.stringify(segments))}
        templates={families}
        programs={programs.map((p) => ({ id: p.id, title: p.title }))}
        sources={sources.map((s) => s.source)}
        canPrepare={canPrepare}
        canApprove={canApprove}
      />
    </div>
  );
}
