import Link from "next/link";
import { listTicketSales } from "@/lib/ticketSales";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";
import { TICKET_STATUS, TRIP_TYPE_LABELS, formatMoney, fmtDay } from "./ticketSaleLabels";

// Service de vente de billets d'avion hors programme (migration 037).
export default async function TicketSalesPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status || "";
  const session = await getSession();
  const canManage = await hasPermission(session, "ticket_sales.manage");

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Accès réservé aux rôles autorisés à gérer la vente de billets.
      </div>
    );
  }

  const all = await listTicketSales();
  const sales = status ? all.filter((s) => s.status === status) : all;
  const active = all.filter((s) => s.status !== "annule");
  const totals = active.reduce(
    (acc, s) => ({
      due: acc.due + Number(s.total_due),
      paid: acc.paid + Number(s.total_paid),
      cost: acc.cost + Number(s.purchase_price),
    }),
    { due: 0, paid: 0, cost: 0 }
  );
  const canViewTotals = ["direction", "comptabilite"].includes(session?.role);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        icon="airplane_ticket"
        title="Billets d'avion"
        description="Vente de billets d'avion hors programme : client, trajet, prix d'achat et de vente, versements et reçus."
      >
        <Link href="/admin/billets/new" className="gf-btn-primary">
          <Icon name="add" size={19} />
          Nouvelle vente
        </Link>
      </PageHeader>

      {canViewTotals && active.length > 0 && (
        <div className="gf-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {[
            ["Chiffre d'affaires", totals.due, "var(--gf-text)"],
            ["Encaissé", totals.paid, "var(--gf-accent)"],
            ["Reste à encaisser", totals.due - totals.paid, totals.due - totals.paid > 0 ? "#a35a00" : "var(--gf-text)"],
            ["Marge", totals.due - totals.cost, totals.due - totals.cost < 0 ? "#c4373b" : "var(--gf-accent)"],
          ].map(([label, value, color]) => (
            <div key={label} className="gf-kpi" style={{ gap: 10 }}>
              <span className="gf-kpi-label">{label}</span>
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", color, whiteSpace: "nowrap" }}>
                {formatMoney(value)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gf-subtle)" }}>MAD</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="gf-segmented self-start">
        {[["", "Toutes"], ...Object.entries(TICKET_STATUS).map(([k, v]) => [k, v.label])].map(([key, label]) => (
          <Link
            key={key || "all"}
            href={key ? `/admin/billets?status=${key}` : "/admin/billets"}
            data-active={status === key}
            scroll={false}
          >
            {label}
            <span className="gf-count">{key ? all.filter((s) => s.status === key).length : all.length}</span>
          </Link>
        ))}
      </div>

      <div className="gf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gf-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Trajet</th>
                <th>Dates</th>
                <th>Compagnie</th>
                <th>PNR</th>
                <th>Statut</th>
                <th style={{ textAlign: "end" }}>Prix de vente</th>
                <th style={{ textAlign: "end" }}>Payé</th>
                <th style={{ textAlign: "end" }}>Solde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const st = TICKET_STATUS[s.status];
                const balance = Number(s.total_due) - Number(s.total_paid);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 500 }} translate="no">
                        {s.full_name}
                      </div>
                      <div className="gf-phone" style={{ color: "var(--gf-subtle)" }} translate="no">
                        {s.phone_whatsapp}
                      </div>
                    </td>
                    <td>
                      <span className="gf-mono" translate="no">
                        {s.origin_iata || "—"} → {s.destination_iata || "—"}
                      </span>
                      <div style={{ fontSize: 12, color: "var(--gf-subtle)" }}>{TRIP_TYPE_LABELS[s.trip_type]}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtDay(s.departure_date)}
                      {s.return_date && <div style={{ fontSize: 12, color: "var(--gf-subtle)" }}>{fmtDay(s.return_date)}</div>}
                    </td>
                    <td translate="no">{s.airline_name || "—"}</td>
                    <td className="gf-mono" translate="no">
                      {s.pnr || "—"}
                    </td>
                    <td>
                      <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>{formatMoney(s.total_due)} MAD</td>
                    <td style={{ textAlign: "end", whiteSpace: "nowrap", color: "var(--gf-accent)" }}>
                      {formatMoney(s.total_paid)} MAD
                    </td>
                    <td
                      style={{
                        textAlign: "end",
                        whiteSpace: "nowrap",
                        color: balance > 0 ? "#c4373b" : "var(--gf-text)",
                      }}
                    >
                      {formatMoney(balance)} MAD
                    </td>
                    <td className="gf-actions">
                      <Link href={`/admin/billets/${s.id}`} title="Afficher" className="gf-btn-icon">
                        <Icon name="visibility" size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="gf-empty">
                      <Icon name="airplane_ticket" />
                      Aucune vente de billet.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
