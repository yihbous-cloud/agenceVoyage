import Link from "next/link";
import { getDashboardStats, listRegistrations } from "@/lib/registrations";
import { getVisaServiceStats } from "@/lib/visaServices";
import { getFinancialSummaryByTrip } from "@/lib/payments";
import { listAllExpensesWithInstallments } from "@/lib/tripExpenses";
import { listVisaServiceRequests } from "@/lib/visaServices";
import { listFlightBookingTotalsByTrip } from "@/lib/flightBookings";
import { listServices } from "@/lib/services";
import { listTicketSales } from "@/lib/ticketSales";
import { summarizeExpenses } from "@/lib/expenseState";
import { isTripArchived } from "@/lib/tripArchive";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getAdminLocale, displayTravelerName } from "@/lib/adminLocale";
import { getCurrentAgency } from "@/lib/currentAgency";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import Icon from "./_components/Icon";
import PageHeader from "./_components/PageHeader";
import FinanceWidget from "./_components/FinanceWidget";

// Tableau de bord — mise en page de référence de la charte (designadmin.md).
const KPIS = [
  { status: "inscrit", label: "Inscrits", icon: "person_add", tone: "#2b5cc4", soft: "#e8f0fd" },
  { status: "confirme", label: "Confirmés", icon: "verified", tone: "#6b3fc4", soft: "#efe9fb" },
  { status: "paye_partiel", label: "Payé partiel", icon: "hourglass_top", tone: "#a35a00", soft: "#fff4e0" },
  { status: "paye_complet", label: "Payé complet", icon: "task_alt", tone: "#0f6b4b", soft: "#e6f4ee" },
  { status: "annule", label: "Annulés", icon: "block", tone: "#c4373b", soft: "#fdecec" },
];

const VISA_STATS = [
  { status: "non_demande", label: "Non demandé", tone: "#a0a0a6" },
  { status: "en_cours", label: "En cours", tone: "#f5a524" },
  { status: "accorde", label: "Accordé", tone: "#12a26b" },
  { status: "refuse", label: "Refusé", tone: "#e5484d" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${String(dateString).slice(0, 10)}T00:00:00`);
  return Math.round((d - today) / DAY_MS);
}

export default async function AdminDashboard() {
  const session = await getSession();
  const locale = await getAdminLocale();
  const agency = await getCurrentAgency();
  const tr = makeTranslator(locale, "admin", { brandName: agency.name });
  const intl = INTL_TAGS[locale] || "fr-FR";
  const canViewFinances = session ? await hasPermission(session, "finances.view") : false;
  const canCreateRegistration = session ? await hasPermission(session, "inscriptions.create") : false;

  const [{ statusCounts, upcomingTrips }, { statusCounts: visaCounts }, partialRegs, financeRows] =
    await Promise.all([
      getDashboardStats(),
      getVisaServiceStats(),
      listRegistrations({ status: "paye_partiel" }),
      canViewFinances ? getFinancialSummaryByTrip() : Promise.resolve([]),
    ]);

  const countFor = (status) => Number(statusCounts.find((s) => s.status === status)?.count || 0);
  const visaCountFor = (status) => Number(visaCounts.find((s) => s.status === status)?.count || 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(intl) : "—");
  const fmtMoney = (n) =>
    Number(n || 0)
      .toLocaleString(intl, { maximumFractionDigits: 0 })
      .replace(/[  ]/g, " ")
      .replace("-", "−");

  const nextTrip = upcomingTrips[0] || null;
  const nextFinance = nextTrip ? financeRows.find((f) => f.trip_id === nextTrip.id) : null;

  // Carte Finances (onglets Programmes / Visa / Billets / Autres services) :
  // toutes les données sont préparées ici, le composant client ne fait que
  // filtrer et masquer/afficher les montants.
  const canViewCharges =
    canViewFinances &&
    ((await hasPermission(session, "charges.view")) || (await hasPermission(session, "charges.manage")));
  const financeData = canViewFinances
    ? await buildFinanceData({
        financeRows,
        canViewCharges,
        canViewTicketSales: await hasPermission(session, "ticket_sales.manage"),
        nextTripId: nextTrip?.id,
        fmtDate,
      })
    : null;

  // « À traiter » : actions réelles déduites des données (aucune IA).
  const upcomingIds = new Set(upcomingTrips.map((t) => t.id));
  const partialUpcoming = partialRegs.filter((r) => upcomingIds.has(r.trip_id));
  const missingPnr = upcomingTrips.filter((t) => t.airline_id && !t.pnr);
  const insights = [];
  if (partialUpcoming.length > 0) {
    insights.push({
      icon: "payments",
      tone: "#a35a00",
      soft: "#fff4e0",
      title: tr("{count} voyageur(s) en paiement partiel", { count: partialUpcoming.length }),
      sub: partialUpcoming
        .slice(0, 3)
        .map((r) => displayTravelerName(r, locale))
        .join(", "),
      subNoTranslate: true,
      cta: tr("Voir"),
      href: "/admin/inscriptions?status=paye_partiel",
    });
  }
  for (const trip of missingPnr.slice(0, 2)) {
    insights.push({
      icon: "confirmation_number",
      tone: "#c4373b",
      soft: "#fdecec",
      title: tr("PNR à renseigner"),
      sub: `${trip.title} · ${tr("Requis pour la liste de réservation")}`,
      cta: tr("Compléter"),
      href: `/admin/programmes/${trip.program_id}`,
    });
  }
  if (nextTrip && Number(nextTrip.total_seats) > 0) {
    const free = Math.max(0, Number(nextTrip.total_seats) - Number(nextTrip.registered_count));
    if (free > 0) {
      insights.push({
        icon: "event_seat",
        tone: "#2b5cc4",
        soft: "#e8f0fd",
        title: tr("{count} place(s) encore disponible(s)", { count: free }),
        sub: `${nextTrip.title} · ${tr("Départ dans {count} jour(s)", { count: daysUntil(nextTrip.departure_date) })}`,
        cta: tr("Voir"),
        href: `/admin/programmes/${nextTrip.program_id}`,
      });
    }
  }

  const rawDate = new Date().toLocaleDateString(intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const longDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        icon="space_dashboard"
        title={tr("Tableau de bord")}
        description={
          <>
            <span>{longDate}</span> · {tr("Vue d'ensemble de l'agence")}
          </>
        }
      />

      {/* KPI */}
      <div className="gf-kpis">
        {KPIS.map((k) => (
          <Link key={k.status} href={`/admin/inscriptions?status=${k.status}`} className="gf-kpi">
            <div className="flex items-center justify-between">
              <span className="gf-kpi-label">{tr(k.label)}</span>
              <span className="gf-kpi-icon" style={{ background: k.soft, color: k.tone }}>
                <Icon name={k.icon} size={18} fill />
              </span>
            </div>
            <div className="gf-kpi-value">{countFor(k.status)}</div>
          </Link>
        ))}
      </div>

      <div className="gf-grid-cards">
        {/* Prochains départs */}
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="flight_takeoff" />
              {tr("Prochains départs")}
            </div>
            <Link href="/admin/programmes" className="gf-card-link">
              {tr("Tous les programmes")}
            </Link>
          </div>

          {upcomingTrips.length === 0 && (
            <div className="gf-empty">
              <Icon name="flight_takeoff" />
              {tr("Aucun départ à venir.")}
            </div>
          )}

          {upcomingTrips.map((trip, index) => {
            const seats = Number(trip.total_seats) || 0;
            const registered = Number(trip.registered_count) || 0;
            const complete = Number(trip.paye_complet_count) || 0;
            const partial = Number(trip.paye_partiel_count) || 0;
            const others = Math.max(0, registered - complete - partial);
            const free = Math.max(0, seats - registered);
            const pct = (n) => (seats > 0 ? `${Math.min(100, (n / seats) * 100)}%` : "0%");
            const days = daysUntil(trip.departure_date);
            const dep = new Date(trip.departure_date);

            return (
              <div
                key={trip.id}
                className="flex flex-col gap-[18px] p-5"
                style={index > 0 ? { borderTop: "1px solid var(--gf-border-soft)" } : undefined}
              >
                <div className="flex flex-wrap items-start gap-[14px]">
                  <div className="gf-date-tile">
                    <div>{dep.toLocaleDateString(intl, { month: "short" }).replace(".", "")}</div>
                    <div>{dep.getDate()}</div>
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/programmes/${trip.program_id}`}
                        translate="no"
                        style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", color: "var(--gf-text)" }}
                      >
                        {trip.title}
                      </Link>
                      <span
                        className="rounded-full"
                        style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", background: "#fff4e0", color: "#a35a00" }}
                      >
                        {days === 0 ? tr("Aujourd'hui") : tr("J-{n}", { n: days })}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-[14px]" style={{ fontSize: 13, color: "var(--gf-muted)" }}>
                      {(trip.origin_iata || trip.destination_iata) && (
                        <span className="inline-flex items-center gap-[5px]" translate="no">
                          <span className="gf-mono" style={{ color: "var(--gf-text)", fontWeight: 500 }}>
                            {trip.origin_iata || "—"}
                          </span>
                          <Icon name={locale === "ar" ? "arrow_back" : "arrow_forward"} size={16} />
                          <span className="gf-mono" style={{ color: "var(--gf-text)", fontWeight: 500 }}>
                            {trip.destination_iata || "—"}
                          </span>
                        </span>
                      )}
                      <span>
                        {fmtDate(trip.departure_date)} – {fmtDate(trip.return_date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canCreateRegistration && ["ouvert", "planifie"].includes(trip.status) && (
                      <Link
                        href={`/admin/inscriptions/new?tripId=${trip.id}`}
                        className="gf-btn-primary"
                        style={{ height: 32, padding: "0 12px", fontSize: 12.5, borderRadius: 8 }}
                        title={tr("Inscrire un voyageur à ce départ")}
                      >
                        <Icon name="person_add" size={16} />
                        {tr("Inscrire")}
                      </Link>
                    )}
                    <Link href={`/admin/voyages/${trip.id}/hebergement`} className="gf-btn-outline">
                      <Icon name="bed" size={16} />
                      {tr("Hébergement")}
                    </Link>
                    <Link href={`/admin/voyages/${trip.id}/listes`} className="gf-btn-outline">
                      <Icon name="list_alt" size={16} />
                      {tr("Listes")}
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between" style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
                    <span>{tr("Remplissage")}</span>
                    <Link href={`/admin/inscriptions?tripId=${trip.id}`} style={{ color: "var(--gf-muted)" }}>
                      <strong style={{ color: "var(--gf-text)", fontWeight: 600 }}>{registered}</strong>
                      {seats > 0 ? ` / ${seats} ${tr("places")}` : ` ${tr("inscrits")}`}
                    </Link>
                  </div>
                  <div className="gf-progress">
                    <div style={{ width: pct(complete), background: "var(--gf-accent)" }} />
                    <div style={{ width: pct(partial), background: "#f5a524" }} />
                    <div style={{ width: pct(others), background: "#8fb3ea" }} />
                  </div>
                  <div className="gf-legend">
                    <Link href={`/admin/inscriptions?tripId=${trip.id}&status=paye_complet`}>
                      <span className="gf-legend-swatch" style={{ background: "var(--gf-accent)" }} />
                      {tr("Payé complet")} · {complete}
                    </Link>
                    <Link href={`/admin/inscriptions?tripId=${trip.id}&status=paye_partiel`}>
                      <span className="gf-legend-swatch" style={{ background: "#f5a524" }} />
                      {tr("Payé partiel")} · {partial}
                    </Link>
                    {others > 0 && (
                      <Link href={`/admin/inscriptions?tripId=${trip.id}`}>
                        <span className="gf-legend-swatch" style={{ background: "#8fb3ea" }} />
                        {tr("Sans paiement")} · {others}
                      </Link>
                    )}
                    {seats > 0 && (
                      <span>
                        <span className="gf-legend-swatch" style={{ background: "#e2e2de" }} />
                        {tr("Disponibles")} · {free}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* À traiter */}
        <div className="gf-card-ai">
          <div>
            <div className="flex items-center gap-2 px-5 py-4" style={{ fontSize: 15, fontWeight: 600 }}>
              <Icon name="task_alt" size={19} fill style={{ color: "var(--gf-accent)" }} />
              {tr("À traiter")}
              <span className="ms-auto inline-flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 500, color: "var(--gf-muted)" }}>
                <span className="gf-live-dot" />
                {tr("En direct")}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-3 pb-3">
              {insights.length === 0 && (
                <div className="gf-empty">
                  <Icon name="check_circle" />
                  {tr("Rien à signaler pour le moment.")}
                </div>
              )}
              {insights.map((s, i) => (
                <Link key={i} href={s.href} className="gf-insight">
                  <span className="gf-kpi-icon flex-none" style={{ background: s.soft, color: s.tone }}>
                    <Icon name={s.icon} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 13.5, fontWeight: 500, textWrap: "pretty" }}>{s.title}</div>
                    <div
                      style={{ fontSize: 12.5, color: "var(--gf-muted)", marginTop: 2 }}
                      translate={s.subNoTranslate ? "no" : undefined}
                    >
                      {s.sub}
                    </div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--gf-accent)", whiteSpace: "nowrap", paddingTop: 2 }}>
                    {s.cta}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="gf-grid-cards">
        {/* Service visa */}
        <div className="gf-card">
          <div className="gf-card-head">
            <div className="gf-card-title">
              <Icon name="assignment" />
              {tr("Service visa")}
            </div>
            <Link href="/admin/visa-services" className="gf-card-link">
              {tr("Voir tout")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-4">
            {VISA_STATS.map((v) => (
              <Link key={v.status} href={`/admin/visa-services?status=${v.status}`} className="gf-stat">
                <span className="gf-stat-label">
                  <span className="gf-dot" style={{ background: v.tone }} />
                  {tr(v.label)}
                </span>
                <span className="gf-stat-value">{visaCountFor(v.status)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Finances : programmes, visa, billets, autres services */}
        {financeData && <FinanceWidget data={financeData} />}
      </div>
    </div>
  );
}

// Données de la carte Finances du tableau de bord.
async function buildFinanceData({ financeRows, canViewCharges, canViewTicketSales, nextTripId, fmtDate }) {
  const [expenses, visaRequests, bookingTotals, services, ticketSales] = await Promise.all([
    canViewCharges ? listAllExpensesWithInstallments() : Promise.resolve([]),
    listVisaServiceRequests(),
    listFlightBookingTotalsByTrip(),
    listServices(),
    canViewTicketSales ? listTicketSales() : Promise.resolve([]),
  ]);

  // Voyages : en cours d'abord (du plus proche départ), puis les voyages
  // clôturés (archivés, lib/tripArchive.js) du plus récent au plus ancien.
  const archivedOf = (t) =>
    isTripArchived({ status: t.trip_status, return_date: t.return_date, departure_date: t.departure_date });
  const trips = [...financeRows].sort((a, b) => {
    const da = String(a.departure_date).slice(0, 10);
    const db = String(b.departure_date).slice(0, 10);
    const aa = archivedOf(a);
    const ab = archivedOf(b);
    if (aa !== ab) return aa ? 1 : -1;
    return aa ? db.localeCompare(da) : da.localeCompare(db);
  });
  const tripLabel = (t) => `${t.program_title} · ${fmtDate(t.departure_date)}${archivedOf(t) ? " · clôturé" : ""}`;

  const programs = trips.map((t) => {
    const tripExpenses = expenses.filter((e) => e.trip_id === t.trip_id);
    return {
      id: t.trip_id,
      label: tripLabel(t),
      programId: tripExpenses[0]?.program_id || null,
      registrations: Number(t.registrations_count || 0),
      due: Number(t.total_due || 0),
      paid: Number(t.total_paid || 0),
      charges: canViewCharges ? summarizeExpenses(tripExpenses) : null,
    };
  });

  const billets = trips.map((t) => {
    const flights = expenses.filter((e) => e.trip_id === t.trip_id && e.category === "billets");
    const booking = bookingTotals.find((b) => b.trip_id === t.trip_id);
    return {
      id: t.trip_id,
      label: tripLabel(t),
      airlines: [...new Set(flights.map((e) => e.airline_name).filter(Boolean))],
      charges: canViewCharges ? summarizeExpenses(flights) : null,
      chargesCount: flights.length,
      duffelCount: Number(booking?.bookings_count || 0),
      duffelTotal: Number(booking?.total_amount || 0),
    };
  });

  // Ventes de billets hors programme (migration 037), hors ventes annulées.
  if (canViewTicketSales) {
    const active = ticketSales.filter((t) => t.status !== "annule");
    billets.unshift({
      id: "sales",
      label: "Ventes de billets hors programme",
      isSales: true,
      count: active.length,
      issued: active.filter((t) => t.status === "emis").length,
      due: active.reduce((sum, t) => sum + Number(t.total_due || 0), 0),
      paid: active.reduce((sum, t) => sum + Number(t.total_paid || 0), 0),
      cost: active.reduce((sum, t) => sum + Number(t.purchase_price || 0), 0),
    });
  }

  const visaTypes = new Map();
  for (const v of visaRequests) {
    const key = v.visa_type_id;
    if (!visaTypes.has(key)) {
      visaTypes.set(key, { id: key, label: `${v.visa_type_name}${v.country ? ` · ${v.country}` : ""}`, requests: [] });
    }
    visaTypes.get(key).requests.push(v);
  }
  const summarizeVisa = (list) => ({
    count: list.length,
    due: list.reduce((sum, v) => sum + Number(v.total_due || 0), 0),
    paid: list.reduce((sum, v) => sum + Number(v.total_paid || 0), 0),
    statuses: ["non_demande", "en_cours", "accorde", "refuse"].map((status) => ({
      status,
      count: list.filter((v) => v.status === status).length,
    })),
  });
  const visa = [
    { id: "all", label: "Tous les types de visa", ...summarizeVisa(visaRequests) },
    ...[...visaTypes.values()].map((t) => ({ id: t.id, label: t.label, ...summarizeVisa(t.requests) })),
  ];

  return {
    canViewCharges,
    defaultTripId: nextTripId || programs[0]?.id || null,
    defaultBilletsId: canViewTicketSales ? "sales" : nextTripId || programs[0]?.id || null,
    programs,
    billets,
    visa,
    services: services.map((sv) => ({ id: sv.id, label: sv.name, price: Number(sv.default_price || 0) })),
  };
}
