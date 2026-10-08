import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listGateways, listPaymentLinks } from "@/lib/payments/online";
import { getCurrentAgency } from "@/lib/currentAgency";
import { query } from "@/lib/db";
import PageHeader from "../_components/PageHeader";
import OnlinePaymentsManager from "./OnlinePaymentsManager";

export const dynamic = "force-dynamic";

// Paiement en ligne : passerelles (Stripe, PayPal, CMI, virement) et liens envoyés.
export default async function OnlinePaymentsPage() {
  const session = await getSession();
  const canLinks = await hasPermission(session, "paiements.liens");
  const canGateways = await hasPermission(session, "paiements.passerelles");
  if (!canLinks && !canGateways) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const agency = await getCurrentAgency();
  const [gateways, links, registrations] = await Promise.all([
    listGateways(),
    listPaymentLinks(),
    query(
      `SELECT r.id, tr.full_name, p.title FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
       WHERE r.agency_id = ? AND r.status NOT IN ('annule', 'paye_complet') ORDER BY r.id DESC LIMIT 300`,
      [session.agencyId]
    ),
  ]);
  const rootDomain = process.env.ROOT_DOMAIN;
  const webhookBase = `${rootDomain ? `https://${rootDomain}` : agency.baseUrl}/api/webhooks/paiement`;
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="credit_card"
        title="Paiement en ligne"
        description="Liens de paiement envoyés aux clients. Un paiement n'est enregistré dans le dossier qu'à réception de la confirmation signée de la passerelle."
      />
      <OnlinePaymentsManager
        initialGateways={JSON.parse(JSON.stringify(gateways))}
        initialLinks={JSON.parse(JSON.stringify(links))}
        registrations={registrations}
        canLinks={canLinks}
        canGateways={canGateways}
        webhookBase={webhookBase}
      />
    </div>
  );
}
