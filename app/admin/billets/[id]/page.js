import { notFound } from "next/navigation";
import Link from "next/link";
import { getTicketSaleById } from "@/lib/ticketSales";
import { listPaymentsForTicketSale } from "@/lib/payments";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import Icon from "../../_components/Icon";
import PaymentsSection from "../../inscriptions/[id]/PaymentsSection";
import TicketSaleForm from "../TicketSaleForm";
import DeleteTicketSaleButton from "./DeleteTicketSaleButton";
import { TICKET_STATUS, TRIP_TYPE_LABELS, formatMoney, fmtDay } from "../ticketSaleLabels";

export default async function TicketSaleDetailPage({ params }) {
  const { id } = await params;
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Accès réservé aux rôles autorisés à gérer la vente de billets.
      </div>
    );
  }

  const sale = await getTicketSaleById(id);
  if (!sale) notFound();
  const [payments, airlines] = await Promise.all([listPaymentsForTicketSale(id), listAirlines()]);

  const st = TICKET_STATUS[sale.status];
  const balance = Number(sale.total_due) - Number(sale.total_paid);
  const margin = Number(sale.total_due) - Number(sale.purchase_price);

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="gf-page-head">
        <div className="gf-page-head-main">
          <div className="gf-page-icon">
            <Icon name="airplane_ticket" size={24} fill />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 translate="no">{sale.full_name}</h1>
              <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>
                {st.label}
              </span>
            </div>
            <p className="gf-page-desc flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="gf-mono" translate="no">
                {sale.origin_iata || "—"} → {sale.destination_iata || "—"}
              </span>
              <span>{TRIP_TYPE_LABELS[sale.trip_type]}</span>
              <span>
                {fmtDay(sale.departure_date)}
                {sale.return_date ? ` – ${fmtDay(sale.return_date)}` : ""}
              </span>
              {sale.airline_name && <span translate="no">{sale.airline_name}</span>}
              <span className="gf-phone" translate="no">
                {sale.phone_whatsapp}
              </span>
            </p>
          </div>
        </div>
        <div className="gf-page-actions">
          <Link href="/admin/billets" className="gf-btn-outline" style={{ height: 38 }}>
            <Icon name="arrow_back" size={16} className="gf-tile-arrow" />
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="gf-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {[
          ["Prix de vente", sale.total_due, "var(--gf-text)"],
          ["Encaissé", sale.total_paid, "var(--gf-accent)"],
          [balance < 0 ? "Trop-perçu" : "Reste à encaisser", Math.abs(balance), balance > 0 ? "#a35a00" : balance < 0 ? "#2b5cc4" : "var(--gf-text)"],
          ["Prix d'achat", sale.purchase_price, "var(--gf-text)"],
          ["Marge", margin, margin < 0 ? "#c4373b" : "var(--gf-accent)"],
        ].map(([label, value, color]) => (
          <div key={label} className="gf-kpi" style={{ gap: 10 }}>
            <span className="gf-kpi-label">{label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", color, whiteSpace: "nowrap" }}>
              {formatMoney(value)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gf-subtle)" }}>MAD</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="gf-card">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="flight" />
              Détails de la vente
            </div>
            <DeleteTicketSaleButton saleId={sale.id} hasPayments={payments.length > 0} />
          </div>
          <div className="p-5">
            <TicketSaleForm sale={sale} airlines={airlines} />
          </div>
        </div>
        <div className="gf-card p-5">
          <PaymentsSection
            apiBasePath={`/api/admin/ticket-sales/${sale.id}`}
            payments={payments}
            totalDue={sale.total_due}
            canManage
            title="Versements"
          />
        </div>
      </div>
    </div>
  );
}
