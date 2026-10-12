import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listRedirects } from "@/lib/redirects";
import { listIndexNowPings } from "@/lib/indexNow";
import { getCurrentAgency } from "@/lib/currentAgency";
import PageHeader from "../_components/PageHeader";
import ReferencementManager from "./ReferencementManager";

export const dynamic = "force-dynamic";

// Référencement (cahier des charges, CLAUDE.md §3centquatorzequadragies) :
// redirections 301 (créées automatiquement ou à la main) et journal des
// notifications IndexNow. Permission seo.manage (direction par défaut).
export default async function ReferencementPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "seo.manage"))) {
    return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  }
  const agency = await getCurrentAgency();
  const [redirects, pings] = await Promise.all([listRedirects(), listIndexNowPings(agency.id)]);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="manage_search"
        title="Référencement"
        description="Redirections des anciennes adresses du site et suivi de l'indexation par les moteurs de recherche."
      />
      <ReferencementManager
        initialRedirects={JSON.parse(JSON.stringify(redirects))}
        pings={JSON.parse(JSON.stringify(pings))}
        baseUrl={agency.baseUrl}
      />
    </div>
  );
}
