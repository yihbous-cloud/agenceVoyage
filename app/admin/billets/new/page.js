import Link from "next/link";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import TicketSaleForm from "../TicketSaleForm";

export default async function NewTicketSalePage() {
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Accès réservé aux rôles autorisés à gérer la vente de billets.
      </div>
    );
  }
  const airlines = await listAirlines();

  return (
    <div className="flex max-w-3xl flex-col gap-[22px]">
      <PageHeader icon="airplane_ticket" title="Nouvelle vente de billet" description="Billet d'avion vendu hors programme.">
        <Link href="/admin/billets" className="gf-btn-outline" style={{ height: 38 }}>
          <Icon name="arrow_back" size={16} className="gf-tile-arrow" />
          Retour à la liste
        </Link>
      </PageHeader>
      <div className="gf-card p-6">
        <TicketSaleForm airlines={airlines} />
      </div>
    </div>
  );
}
