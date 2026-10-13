import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listRedirects } from "@/lib/redirects";
import { listIndexNowPings } from "@/lib/indexNow";
import { getCurrentAgency } from "@/lib/currentAgency";
import { getLeadSourceReports } from "@/lib/leadReports";
import { getAgencySettings } from "@/lib/agencySettings";
import { getSeoHealth } from "@/lib/seoHealth";
import PageHeader from "../_components/PageHeader";
import ReferencementManager from "./ReferencementManager";

export const dynamic = "force-dynamic";

// Référencement (cahier des charges, CLAUDE.md §3centquatorzequadragies) :
// santé SEO (vague 2C), redirections 301 (créées automatiquement ou à la
// main), journal des notifications IndexNow et sources des demandes.
// Permission seo.manage (direction par défaut). ?onglet= ouvre un onglet.
const TABS = ["sante", "redirections", "indexation", "sources"];

export default async function ReferencementPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "seo.manage"))) {
    return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  }
  const agency = await getCurrentAgency();
  const [redirects, pings, leadReports, settings, health] = await Promise.all([
    listRedirects(),
    listIndexNowPings(agency.id),
    getLeadSourceReports(agency.id),
    getAgencySettings(agency.id),
    getSeoHealth(agency.id),
  ]);
  const { onglet } = (await searchParams) || {};

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="manage_search"
        title="Référencement"
        description="Santé SEO des contenus, redirections des anciennes adresses du site et suivi de l'indexation par les moteurs de recherche."
      />
      <ReferencementManager
        initialRedirects={JSON.parse(JSON.stringify(redirects))}
        pings={JSON.parse(JSON.stringify(pings))}
        baseUrl={agency.baseUrl}
        leadReports={leadReports}
        gtmId={settings?.gtm_container_id || null}
        health={health}
        initialTab={TABS.includes(onglet) ? onglet : "sante"}
      />
    </div>
  );
}
