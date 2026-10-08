import Link from "next/link";
import { getFinancialSummaryByTrip, getPaymentsByPeriod } from "@/lib/payments";
import { listVisaServiceRequests } from "@/lib/visaServices";
import { listTicketSales } from "@/lib/ticketSales";
import { listOutstandingCredits } from "@/lib/credits";
import { isTripArchived } from "@/lib/tripArchive";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PeriodFilter from "./PeriodFilter";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";
import { listAllExpensesWithInstallments } from "@/lib/tripExpenses";
import { TICKET_STATUS } from "../billets/ticketSaleLabels";
import { EXPENSE_CATEGORY_META, installmentState, summarizeExpenses, todayIso } from "@/lib/expenseState";

const INSTALLMENT_STATE_PILLS = {
  late: { label: "En retard", bg: "#fdecec", fg: "#c4373b" },
  todo: { label: "À payer", bg: "#fff4e0", fg: "#a35a00" },
  in_progress: { label: "Paiement en cours", bg: "#e8f0fd", fg: "#2b5cc4" },
};

function fmtDay(d) {
  return d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—";
}

function money(n) {
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

export default async function FinancesPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "finances.view"))) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Accès réservé à la direction et à la comptabilité.
      </div>
    );
  }

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = params?.start || today.slice(0, 8) + "01";
  const endDate = params?.end || today;

  // Charges des programmes (migration 035) : visibles avec charges.view ou
  // charges.manage, en plus de finances.view (accès à la page).
  const canViewCharges =
    (await hasPermission(session, "charges.view")) || (await hasPermission(session, "charges.manage"));

  const [byTrip, visaServiceRequests, periodPayments, allExpenses] = await Promise.all([
    getFinancialSummaryByTrip(),
    listVisaServiceRequests(),
    getPaymentsByPeriod(startDate, endDate),
    canViewCharges ? listAllExpensesWithInstallments() : Promise.resolve([]),
  ]);

  // Charges regroupées par voyage, croisées avec le montant dû des inscrits
  // (marge prévisionnelle = dû − charges).
  const expenseTrips = [];
  for (const e of allExpenses) {
    let row = expenseTrips.find((r) => r.tripId === e.trip_id);
    if (!row) {
      row = {
        tripId: e.trip_id,
        programId: e.program_id,
        programTitle: e.program_title,
        reference: e.reference_code,
        departureDate: e.departure_date,
        expenses: [],
      };
      expenseTrips.push(row);
    }
    row.expenses.push(e);
  }
  for (const row of expenseTrips) {
    row.summary = summarizeExpenses(row.expenses);
    const fin = byTrip.find((t) => t.trip_id === row.tripId);
    row.due = fin ? Number(fin.total_due) : 0;
    row.margin = row.due - row.summary.total;
  }
  const chargesTotals = summarizeExpenses(allExpenses);
  const chargesMargin = expenseTrips.reduce((sum, r) => sum + r.margin, 0);

  // Échéancier : toutes les échéances non encore payées, par date.
  const todayLocal = todayIso();
  const openInstallments = allExpenses
    .flatMap((e) => e.installments.map((i) => ({ ...i, expense: e, state: installmentState(i, todayLocal) })))
    .filter((i) => i.state !== "paid")
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const periodTotal = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Totaux réservés à direction/comptabilité — demande explicite : un rôle
  // qui obtiendrait "finances.view" sans être l'un des deux (voir
  // CLAUDE.md §3undecies, exception assumée par rôle brut) voit le détail
  // ligne par ligne mais jamais les sommes agrégées.
  const canViewTotals = ["direction", "comptabilite"].includes(session?.role);

  const byTripTotals = byTrip.reduce(
    (acc, t) => ({
      due: acc.due + Number(t.total_due),
      paid: acc.paid + Number(t.total_paid),
      balance: acc.balance + Number(t.balance_due),
    }),
    { due: 0, paid: 0, balance: 0 }
  );

  // Ventes de billets hors programme (migration 037) — ticket_sales.manage ;
  // les ventes annulées sont listées mais exclues des totaux.
  const canViewTicketSales = await hasPermission(session, "ticket_sales.manage");
  const ticketSales = canViewTicketSales ? await listTicketSales() : [];
  const ticketTotals = ticketSales
    .filter((t) => t.status !== "annule")
    .reduce(
      (acc, t) => ({
        due: acc.due + Number(t.total_due),
        paid: acc.paid + Number(t.total_paid),
        balance: acc.balance + Number(t.total_due) - Number(t.total_paid),
        cost: acc.cost + Number(t.purchase_price),
      }),
      { due: 0, paid: 0, balance: 0, cost: 0 }
    );

  // Crédits en cours (reste dû par les clients), séparés entre programmes
  // en cours et programmes clôturés (archivés, lib/tripArchive.js).
  const [currentCredits, archivedCredits] = await Promise.all([
    listOutstandingCredits({ archived: false }),
    listOutstandingCredits({ archived: true }),
  ]);
  const sumBalance = (list) => list.reduce((sum, c) => sum + c.balance, 0);

  const visaServiceTotals = visaServiceRequests.reduce(
    (acc, v) => {
      const balance = Number(v.total_due) - Number(v.total_paid);
      return {
        due: acc.due + Number(v.total_due),
        paid: acc.paid + Number(v.total_paid),
        balance: acc.balance + balance,
      };
    },
    { due: 0, paid: 0, balance: 0 }
  );

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        icon="account_balance_wallet"
        title="Finances"
        description="Suivi des montants dus, encaissés et soldes."
      />

      {canViewTotals && (
        <div className="gf-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[
            ["Total dû", byTripTotals.due + visaServiceTotals.due + ticketTotals.due, "var(--gf-text)"],
            ["Total encaissé", byTripTotals.paid + visaServiceTotals.paid + ticketTotals.paid, "var(--gf-accent)"],
            [
              "Solde global",
              byTripTotals.balance + visaServiceTotals.balance + ticketTotals.balance,
              byTripTotals.balance + visaServiceTotals.balance + ticketTotals.balance > 0 ? "#c4373b" : "var(--gf-text)",
            ],
          ].map(([label, value, color]) => (
            <div key={label} className="gf-kpi" style={{ gap: 10 }}>
              <span className="gf-kpi-label">{label}</span>
              <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.03em", color, whiteSpace: "nowrap" }}>
                {money(value)} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gf-subtle)" }}>MAD</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="gf-card-title"><Icon name="luggage" size={18} />Par voyage</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Inscrits</th>
                <th className="px-4 py-3">Dû</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Solde</th>
              </tr>
            </thead>
            <tbody>
              {byTrip.map((t) => (
                <tr key={t.trip_id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    {t.program_title}
                    {isTripArchived({ status: t.trip_status, return_date: t.return_date, departure_date: t.departure_date }) && (
                      <span className="ms-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Clôturé</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/inscriptions?tripId=${t.trip_id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {t.reference_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(t.departure_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">{t.registrations_count}</td>
                  <td className="px-4 py-3">{money(t.total_due)} MAD</td>
                  <td className="px-4 py-3 text-emerald-700">{money(t.total_paid)} MAD</td>
                  <td className={`px-4 py-3 ${t.balance_due > 0 ? "text-red-600" : ""}`}>
                    {money(t.balance_due)} MAD
                  </td>
                </tr>
              ))}
              {byTrip.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                    Aucun voyage.
                  </td>
                </tr>
              )}
            </tbody>
            {canViewTotals && byTrip.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td className="px-4 py-3" colSpan={4}>
                    Total
                  </td>
                  <td className="px-4 py-3">{money(byTripTotals.due)} MAD</td>
                  <td className="px-4 py-3 text-emerald-700">
                    {money(byTripTotals.paid)} MAD
                  </td>
                  <td className={`px-4 py-3 ${byTripTotals.balance > 0 ? "text-red-600" : ""}`}>
                    {money(byTripTotals.balance)} MAD
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {canViewCharges && (
        <section>
          <h2 className="gf-card-title">
            <Icon name="receipt_long" size={18} />
            Charges des programmes
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Programme</th>
                  <th className="px-4 py-3">Départ</th>
                  <th className="px-4 py-3">Charges</th>
                  <th className="px-4 py-3">Payé</th>
                  <th className="px-4 py-3">Reste à payer</th>
                  <th className="px-4 py-3">En retard</th>
                  <th className="px-4 py-3">Prochaine échéance</th>
                  <th className="px-4 py-3">Marge (dû − charges)</th>
                </tr>
              </thead>
              <tbody>
                {expenseTrips.map((r) => (
                  <tr key={r.tripId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/programmes/${r.programId}`} className="text-emerald-700 hover:underline">
                        {r.programTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{fmtDay(r.departureDate)}</td>
                    <td className="px-4 py-3">{money(r.summary.total)} MAD</td>
                    <td className="px-4 py-3 text-emerald-700">{money(r.summary.paid)} MAD</td>
                    <td className={`px-4 py-3 ${r.summary.remaining > 0 ? "text-amber-700" : ""}`}>
                      {money(r.summary.remaining)} MAD
                    </td>
                    <td className={`px-4 py-3 ${r.summary.overdue > 0 ? "font-medium text-red-600" : "text-zinc-400"}`}>
                      {r.summary.overdue > 0 ? `${money(r.summary.overdue)} MAD` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.summary.nextDue
                        ? `${fmtDay(r.summary.nextDue.date)} · ${money(r.summary.nextDue.amount)} MAD`
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${r.margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {money(r.margin)} MAD
                    </td>
                  </tr>
                ))}
                {expenseTrips.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-zinc-500" colSpan={8}>
                      Aucune charge enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
              {canViewTotals && expenseTrips.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-3">{money(chargesTotals.total)} MAD</td>
                    <td className="px-4 py-3 text-emerald-700">{money(chargesTotals.paid)} MAD</td>
                    <td className="px-4 py-3">{money(chargesTotals.remaining)} MAD</td>
                    <td className={`px-4 py-3 ${chargesTotals.overdue > 0 ? "text-red-600" : ""}`}>
                      {money(chargesTotals.overdue)} MAD
                    </td>
                    <td className="px-4 py-3" />
                    <td className={`px-4 py-3 ${chargesMargin < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {money(chargesMargin)} MAD
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-zinc-700">Échéancier des charges à payer</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Date prévue</th>
                  <th className="px-4 py-3">Programme</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Charge</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">État</th>
                </tr>
              </thead>
              <tbody>
                {openInstallments.map((i) => {
                  const meta = EXPENSE_CATEGORY_META[i.expense.category];
                  const pill = INSTALLMENT_STATE_PILLS[i.state];
                  return (
                    <tr key={i.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">{fmtDay(i.due_date)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/programmes/${i.expense.program_id}`} className="text-emerald-700 hover:underline">
                          {i.expense.program_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name={meta.icon} size={16} style={{ color: meta.tone }} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {i.expense.label || i.expense.hotel_name || i.expense.airline_name || meta.label}
                      </td>
                      <td className="px-4 py-3 font-medium">{money(i.amount)} MAD</td>
                      <td className="px-4 py-3">
                        <span className="gf-pill" style={{ background: pill.bg, color: pill.fg }}>
                          {pill.label}
                        </span>
                        {i.state === "in_progress" && (
                          <span className="ms-2 text-xs text-zinc-500">{fmtDay(i.paid_date)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {openInstallments.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                      Aucune échéance à payer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="gf-card-title">
          <Icon name="account_balance_wallet" size={18} />
          Crédits en cours
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Montants restant dus par les voyageurs (inscriptions individuelles et groupes), séparés entre programmes en
          cours et programmes clôturés.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="gf-kpi" style={{ gap: 8 }}>
            <span className="gf-kpi-label">Programmes en cours</span>
            <span style={{ fontSize: 22, fontWeight: 600, whiteSpace: "nowrap", color: "#a35a00" }}>
              {money(sumBalance(currentCredits))} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gf-subtle)" }}>MAD</span>
            </span>
            <span style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
              {currentCredits.length} débiteur(s) — à encaisser avant le départ
            </span>
          </div>
          <div className="gf-kpi" style={{ gap: 8, borderColor: archivedCredits.length ? "#f7cfd0" : undefined }}>
            <span className="gf-kpi-label">Programmes clôturés</span>
            <span style={{ fontSize: 22, fontWeight: 600, whiteSpace: "nowrap", color: archivedCredits.length ? "#c4373b" : "var(--gf-text)" }}>
              {money(sumBalance(archivedCredits))} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gf-subtle)" }}>MAD</span>
            </span>
            <span style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
              {archivedCredits.length} débiteur(s) — voyage terminé, crédit à recouvrer
            </span>
          </div>
        </div>

        {[
          ["Programmes clôturés — crédits à recouvrer", archivedCredits, true],
          ["Programmes en cours", currentCredits, false],
        ].map(([title, list, isArchived]) => (
          <div key={title} className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
            <div
              className="mt-2 overflow-x-auto rounded-xl border bg-white"
              style={{ borderColor: isArchived && list.length ? "#f7cfd0" : "var(--gf-border)" }}
            >
              <table className="w-full text-start text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Débiteur</th>
                    <th className="px-4 py-3">Programme</th>
                    <th className="px-4 py-3">Départ</th>
                    <th className="px-4 py-3">Dû</th>
                    <th className="px-4 py-3">Payé</th>
                    <th className="px-4 py-3">Reste dû</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={`${c.kind}-${c.id}`} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={c.kind === "groupe" ? `/admin/groupes/${c.id}` : `/admin/inscriptions/${c.id}`}
                          className="text-emerald-700 hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.kind === "groupe" && <span className="ms-2 text-xs text-zinc-500">(groupe)</span>}
                      </td>
                      <td className="px-4 py-3">{c.program_title}</td>
                      <td className="px-4 py-3">{new Date(c.departure_date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3">{money(c.total_due)} MAD</td>
                      <td className="px-4 py-3 text-emerald-700">{money(c.total_paid)} MAD</td>
                      <td className={`px-4 py-3 font-medium ${isArchived ? "text-red-600" : "text-amber-700"}`}>
                        {money(c.balance)} MAD
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                        Aucun crédit en cours.
                      </td>
                    </tr>
                  )}
                </tbody>
                {canViewTotals && list.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-zinc-200 font-semibold">
                      <td className="px-4 py-3" colSpan={5}>
                        Total
                      </td>
                      <td className={`px-4 py-3 ${isArchived ? "text-red-600" : "text-amber-700"}`}>
                        {money(sumBalance(list))} MAD
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="gf-card-title"><Icon name="assignment" size={18} />Services</h2>
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-zinc-700">Service visa</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Type de visa</th>
                  <th className="px-4 py-3">Dû</th>
                  <th className="px-4 py-3">Payé</th>
                  <th className="px-4 py-3">Solde</th>
                </tr>
              </thead>
              <tbody>
                {visaServiceRequests.map((v) => {
                  const balanceDue = Number(v.total_due) - Number(v.total_paid);
                  return (
                    <tr key={v.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/visa-services/${v.id}`}
                          className="text-emerald-700 hover:underline"
                        >
                          {v.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {v.visa_type_name}
                        {v.country && <span className="text-zinc-400"> ({v.country})</span>}
                      </td>
                      <td className="px-4 py-3">{money(v.total_due)} MAD</td>
                      <td className="px-4 py-3 text-emerald-700">{money(v.total_paid)} MAD</td>
                      <td className={`px-4 py-3 ${balanceDue > 0 ? "text-red-600" : ""}`}>
                        {money(balanceDue)} MAD
                      </td>
                    </tr>
                  );
                })}
                {visaServiceRequests.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-zinc-500" colSpan={5}>
                      Aucune demande de service visa.
                    </td>
                  </tr>
                )}
              </tbody>
              {canViewTotals && visaServiceRequests.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-3">{money(visaServiceTotals.due)} MAD</td>
                    <td className="px-4 py-3 text-emerald-700">
                      {money(visaServiceTotals.paid)} MAD
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        visaServiceTotals.balance > 0 ? "text-red-600" : ""
                      }`}
                    >
                      {money(visaServiceTotals.balance)} MAD
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {canViewTicketSales && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-zinc-700">Vente de billets d&apos;avion</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Trajet</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Prix d&apos;achat</th>
                    <th className="px-4 py-3">Dû</th>
                    <th className="px-4 py-3">Payé</th>
                    <th className="px-4 py-3">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketSales.map((t) => {
                    const balance = Number(t.total_due) - Number(t.total_paid);
                    return (
                      <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/admin/billets/${t.id}`} className="text-emerald-700 hover:underline">
                            {t.full_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {t.origin_iata || "—"} → {t.destination_iata || "—"}
                        </td>
                        <td className="px-4 py-3">{TICKET_STATUS[t.status]?.label || t.status}</td>
                        <td className="px-4 py-3">{money(t.purchase_price)} MAD</td>
                        <td className="px-4 py-3">{money(t.total_due)} MAD</td>
                        <td className="px-4 py-3 text-emerald-700">{money(t.total_paid)} MAD</td>
                        <td className={`px-4 py-3 ${balance > 0 ? "text-red-600" : ""}`}>{money(balance)} MAD</td>
                      </tr>
                    );
                  })}
                  {ticketSales.length === 0 && (
                    <tr>
                      <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                        Aucune vente de billet.
                      </td>
                    </tr>
                  )}
                </tbody>
                {canViewTotals && ticketSales.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-zinc-200 font-semibold">
                      <td className="px-4 py-3" colSpan={3}>
                        Total (hors annulées)
                      </td>
                      <td className="px-4 py-3">{money(ticketTotals.cost)} MAD</td>
                      <td className="px-4 py-3">{money(ticketTotals.due)} MAD</td>
                      <td className="px-4 py-3 text-emerald-700">{money(ticketTotals.paid)} MAD</td>
                      <td className={`px-4 py-3 ${ticketTotals.balance > 0 ? "text-red-600" : ""}`}>
                        {money(ticketTotals.balance)} MAD
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="gf-card-title">
            <Icon name="payments" size={18} />
            Paiements par période
          </h2>
          <PeriodFilter start={startDate} end={endDate} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voyageur</th>
                <th className="px-4 py-3">Programme / Voyage</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Montant</th>
              </tr>
            </thead>
            <tbody>
              {periodPayments.map((p) => {
                // Un remboursement (annulation, retour d'avance ou du
                // montant total, voir CLAUDE.md) est un versement au
                // montant négatif — reconnu ici uniquement par le signe.
                const isRefund = Number(p.amount) < 0;
                return (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    {new Date(p.payment_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {p.full_name}
                    {isRefund && (
                      <span className="ms-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Remboursement
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.program_title} — {p.reference_code}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                  <td className="px-4 py-3">{p.receipt_reference || "—"}</td>
                  <td className={`px-4 py-3 font-medium ${isRefund ? "text-red-600" : ""}`}>
                    {isRefund ? "−" : ""}
                    {Math.abs(Number(p.amount))} {p.currency}
                  </td>
                </tr>
                );
              })}
              {periodPayments.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                    Aucun paiement sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
            {canViewTotals && periodPayments.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>
                    Total
                  </td>
                  <td className="px-4 py-3">{money(periodTotal)} MAD</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
