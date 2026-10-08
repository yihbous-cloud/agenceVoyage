"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "./Icon";
import { useAdminLocale } from "./AdminLocale";

// Carte « Finances » du tableau de bord (charte designadmin.md) : quatre
// onglets (Programmes / Visa / Billets / Autres services), une liste
// déroulante pour choisir l'élément, puis son détail financier. Tous les
// montants sont MASQUÉS (« ****** ») tant que l'icône œil n'est pas cliquée —
// confidentialité à l'écran (les données restent réservées à finances.view).
const TABS = [
  { key: "programs", label: "Programmes", icon: "travel_explore" },
  { key: "visa", label: "Visa", icon: "badge" },
  { key: "billets", label: "Billets", icon: "airplane_ticket" },
  { key: "services", label: "Autres services", icon: "room_service" },
];

const VISA_STATUS = {
  non_demande: { label: "Non demandé", tone: "#a0a0a6" },
  en_cours: { label: "En cours", tone: "#f5a524" },
  accorde: { label: "Accordé", tone: "#12a26b" },
  refuse: { label: "Refusé", tone: "#e5484d" },
};

const MASK = "******";

function formatAmount(value) {
  return Number(value || 0)
    .toLocaleString("fr-FR", { maximumFractionDigits: 0 })
    .replace(/[  ]/g, " ")
    .replace("-", "−");
}

export default function FinanceWidget({ data }) {
  const { tr } = useAdminLocale();
  const [tab, setTab] = useState("programs");
  const [revealed, setRevealed] = useState(false);
  const [selection, setSelection] = useState({
    programs: data.defaultTripId,
    billets: data.defaultBilletsId ?? data.defaultTripId,
    visa: "all",
    services: data.services[0]?.id ?? null,
  });

  // Montant (ou pourcentage) masqué tant que l'œil n'est pas activé.
  const Money = ({ value, color = "var(--gf-text)", large = false, suffix = "MAD" }) => (
    <span
      style={{
        fontSize: large ? 20 : 17,
        fontWeight: 600,
        letterSpacing: revealed ? "-.02em" : ".08em",
        whiteSpace: "nowrap",
        color: revealed ? color : "var(--gf-subtle)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {revealed ? formatAmount(value) : MASK}{" "}
      {suffix && <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.75, letterSpacing: 0 }}>{tr(suffix)}</span>}
    </span>
  );
  const Pct = ({ value }) => (
    <strong style={{ color: "var(--gf-text)", fontWeight: 600 }}>{revealed ? `${value}%` : "***"}</strong>
  );
  const Bar = ({ ratio, color }) => (
    <div className="gf-progress mt-2.5" style={{ height: 6 }}>
      <div style={{ width: revealed ? `${Math.max(0, Math.min(100, ratio * 100))}%` : "0%", background: color }} />
    </div>
  );

  const options = {
    programs: data.programs,
    billets: data.billets,
    visa: data.visa,
    services: data.services,
  }[tab];
  const current = options.find((o) => String(o.id) === String(selection[tab])) || options[0] || null;

  return (
    <div className="gf-card" style={{ gridColumn: "1 / -1" }}>
      <div className="gf-card-head gf-divided">
        <div className="gf-card-title">
          <Icon name="account_balance_wallet" />
          {tr("Finances")}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="gf-btn-outline"
            title={revealed ? tr("Masquer les montants") : tr("Afficher les montants")}
            aria-pressed={revealed}
          >
            <Icon name={revealed ? "visibility_off" : "visibility"} size={16} />
            {revealed ? tr("Masquer") : tr("Afficher")}
          </button>
          <Link href="/admin/finances" className="gf-card-link">
            {tr("Détails")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Onglets + liste déroulante */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="gf-segmented">
            {TABS.map((t) => (
              <button key={t.key} type="button" data-active={tab === t.key} onClick={() => setTab(t.key)}>
                <Icon name={t.icon} size={16} />
                {tr(t.label)}
              </button>
            ))}
          </div>
          {options.length > 0 && (
            <select
              value={current ? String(current.id) : ""}
              onChange={(e) => setSelection((s) => ({ ...s, [tab]: e.target.value }))}
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              style={{ maxWidth: 420 }}
              aria-label={tr("Choisir")}
            >
              {options.map((o) => (
                <option key={o.id} value={String(o.id)} translate={o.id === "all" || o.id === "sales" ? undefined : "no"}>
                  {o.id === "all" || o.id === "sales" ? tr(o.label) : o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {!current && (
          <div className="gf-empty" style={{ padding: "24px 12px" }}>
            <Icon name="inbox" />
            {tab === "services"
              ? tr("Aucun service dans le catalogue.")
              : tr("Aucune donnée pour le moment.")}
          </div>
        )}

        {current && tab === "programs" && <ProgramDetail p={current} canViewCharges={data.canViewCharges} {...{ Money, Pct, Bar, tr, revealed }} />}
        {current && tab === "visa" && <VisaDetail v={current} {...{ Money, Pct, Bar, tr, revealed }} />}
        {current && tab === "billets" && <BilletsDetail b={current} canViewCharges={data.canViewCharges} {...{ Money, Bar, tr, revealed }} />}
        {current && tab === "services" && <ServiceDetail sv={current} {...{ Money, tr }} />}
      </div>
    </div>
  );
}

function SectionTitle({ icon, color, children, right }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2" style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
      <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--gf-text-2)" }}>
        <Icon name={icon} size={16} style={{ color }} />
        {children}
      </span>
      {right}
    </div>
  );
}

function Stat({ label, children, bg }) {
  return (
    <div className="gf-stat" style={bg ? { background: bg } : undefined}>
      <span className="gf-stat-label">{label}</span>
      {children}
    </div>
  );
}

function fmtDay(d) {
  return d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "";
}

// Recettes (inscrits) + charges du voyage + marge
function ProgramDetail({ p, canViewCharges, Money, Pct, Bar, tr, revealed }) {
  const toCollect = p.due - p.paid;
  const rate = p.due > 0 ? Math.round((p.paid / p.due) * 100) : 0;
  const c = p.charges;
  const margin = c ? p.due - c.total : 0;
  const cash = c ? p.paid - c.paid : 0;
  return (
    <>
      <div>
        <SectionTitle
          icon="payments"
          color="var(--gf-accent)"
          right={
            <span>
              {tr("Taux d'encaissement")} <Pct value={rate} />
            </span>
          }
        >
          {tr("Recettes des inscrits")}
          <span style={{ fontWeight: 400, color: "var(--gf-subtle)" }}>
            {" "}
            · {tr.plural("{count} inscrit", "{count} inscrits", p.registrations)}
          </span>
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={tr("Dû")}>
            <Money value={p.due} />
          </Stat>
          <Stat label={tr("Encaissé")} bg="color-mix(in oklch, var(--gf-accent) 8%, #fff)">
            <Money value={p.paid} color="var(--gf-accent)" />
          </Stat>
          <Stat
            label={!revealed ? tr("Solde") : toCollect < 0 ? tr("Trop-perçu") : tr("Reste à encaisser")}
            bg={!revealed ? undefined : toCollect > 0 ? "#fff8eb" : toCollect < 0 ? "#f0f5fe" : undefined}
          >
            <Money value={Math.abs(toCollect)} color={toCollect > 0 ? "#a35a00" : toCollect < 0 ? "#2b5cc4" : "var(--gf-text)"} />
          </Stat>
        </div>
        <Bar ratio={p.due > 0 ? p.paid / p.due : 0} color="var(--gf-accent)" />
      </div>

      {canViewCharges && c && (
        <div>
          <SectionTitle
            icon="receipt_long"
            color="#a35a00"
            right={
              c.overdue > 0 ? (
                <span className="gf-pill" style={{ background: "#fdecec", color: "#c4373b" }}>
                  {tr("En retard")}
                </span>
              ) : c.nextDue ? (
                <span>
                  {tr("Prochaine échéance")} <strong style={{ color: "var(--gf-text)" }}>{fmtDay(c.nextDue.date)}</strong>
                </span>
              ) : null
            }
          >
            {tr("Charges du voyage")}
          </SectionTitle>
          {c.total > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={tr("Total des charges")}>
                  <Money value={c.total} />
                </Stat>
                <Stat label={tr("Payé")}>
                  <Money value={c.paid} />
                </Stat>
                <Stat label={tr("Reste à payer")} bg={revealed && c.remaining > 0 ? "#fff8eb" : undefined}>
                  <Money value={c.remaining} color={c.remaining > 0 ? "#a35a00" : "var(--gf-text)"} />
                </Stat>
              </div>
              <Bar ratio={c.total > 0 ? c.paid / c.total : 0} color="#f5a524" />
            </>
          ) : (
            <Link
              href={p.programId ? `/admin/programmes/${p.programId}` : "/admin/programmes"}
              className="gf-stat"
              style={{ fontSize: 12.5, color: "var(--gf-muted)" }}
            >
              {tr("Aucune charge enregistrée — à saisir sur la fiche programme.")}
            </Link>
          )}
        </div>
      )}

      {canViewCharges && c && c.total > 0 && (
        <div className="grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: "var(--gf-border-soft)" }}>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>
              {tr("Marge prévisionnelle")} <span style={{ color: "var(--gf-subtle)" }}>({tr("dû − charges")})</span>
            </span>
            <Money value={margin} large color={margin < 0 ? "#c4373b" : "var(--gf-accent)"} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>
              {tr("Trésorerie actuelle")} <span style={{ color: "var(--gf-subtle)" }}>({tr("encaissé − charges payées")})</span>
            </span>
            <Money value={cash} large color={cash < 0 ? "#c4373b" : "var(--gf-text)"} />
          </div>
        </div>
      )}
    </>
  );
}

// Service visa autonome (hors voyage) : par type de visa ou tous types
function VisaDetail({ v, Money, Pct, Bar, tr, revealed }) {
  const toCollect = v.due - v.paid;
  const rate = v.due > 0 ? Math.round((v.paid / v.due) * 100) : 0;
  return (
    <>
      <div>
        <SectionTitle
          icon="badge"
          color="var(--gf-accent)"
          right={
            <span>
              {tr("Taux d'encaissement")} <Pct value={rate} />
            </span>
          }
        >
          {tr("Service visa")}
          <span style={{ fontWeight: 400, color: "var(--gf-subtle)" }}>
            {" "}
            · {tr.plural("{count} demande", "{count} demandes", v.count)}
          </span>
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={tr("Dû")}>
            <Money value={v.due} />
          </Stat>
          <Stat label={tr("Encaissé")} bg="color-mix(in oklch, var(--gf-accent) 8%, #fff)">
            <Money value={v.paid} color="var(--gf-accent)" />
          </Stat>
          <Stat
            label={!revealed ? tr("Solde") : toCollect < 0 ? tr("Trop-perçu") : tr("Reste à encaisser")}
            bg={!revealed ? undefined : toCollect > 0 ? "#fff8eb" : toCollect < 0 ? "#f0f5fe" : undefined}
          >
            <Money value={Math.abs(toCollect)} color={toCollect > 0 ? "#a35a00" : toCollect < 0 ? "#2b5cc4" : "var(--gf-text)"} />
          </Stat>
        </div>
        <Bar ratio={v.due > 0 ? v.paid / v.due : 0} color="var(--gf-accent)" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {v.statuses.map((s) => (
          <Link key={s.status} href={`/admin/visa-services?status=${s.status}`} className="gf-stat">
            <span className="gf-stat-label">
              <span className="gf-dot" style={{ background: VISA_STATUS[s.status].tone }} />
              {tr(VISA_STATUS[s.status].label)}
            </span>
            <span className="gf-stat-value" style={{ fontSize: 18 }}>
              {s.count}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

// Billets d'avion : coût (charges « billets » du voyage) + achats Duffel
function BilletsDetail({ b, canViewCharges, Money, Bar, tr, revealed }) {
  if (b.isSales) return <TicketSalesDetail s={b} {...{ Money, Bar, tr, revealed }} />;
  const c = b.charges;
  return (
    <>
      <div>
        <SectionTitle
          icon="flight"
          color="#6b3fc4"
          right={
            b.airlines.length > 0 ? (
              <span translate="no" style={{ color: "var(--gf-text-2)" }}>
                {b.airlines.join(" · ")}
              </span>
            ) : null
          }
        >
          {tr("Coût des billets")}
        </SectionTitle>
        {!canViewCharges ? (
          <div className="gf-stat" style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
            {tr("Réservé aux rôles ayant accès aux charges financières.")}
          </div>
        ) : c && c.total > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={tr("Total des charges")}>
                <Money value={c.total} />
              </Stat>
              <Stat label={tr("Payé")}>
                <Money value={c.paid} />
              </Stat>
              <Stat label={tr("Reste à payer")} bg={revealed && c.remaining > 0 ? "#fff8eb" : undefined}>
                <Money value={c.remaining} color={c.remaining > 0 ? "#a35a00" : "var(--gf-text)"} />
              </Stat>
            </div>
            <Bar ratio={c.total > 0 ? c.paid / c.total : 0} color="#6b3fc4" />
            {(c.overdue > 0 || c.nextDue) && (
              <p className="mt-2" style={{ fontSize: 12.5, color: c.overdue > 0 ? "#c4373b" : "var(--gf-muted)" }}>
                {c.overdue > 0 ? tr("En retard") : `${tr("Prochaine échéance")} · ${fmtDay(c.nextDue.date)}`}
              </p>
            )}
          </>
        ) : (
          <div className="gf-stat" style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
            {tr("Aucune charge « Billets d'avion » enregistrée pour ce voyage.")}
          </div>
        )}
      </div>
      {b.duffelCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label={tr("Achats en ligne (Duffel)")}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{b.duffelCount}</span>
          </Stat>
          <Stat label={tr("Montant acheté")}>
            <Money value={b.duffelTotal} />
          </Stat>
        </div>
      )}
    </>
  );
}

// Autres services : catalogue — inclus dans le prix des programmes, aucune
// vente séparée (CLAUDE.md §3sedecies).
function ServiceDetail({ sv, Money, tr }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label={tr("Prix catalogue")}>
        <Money value={sv.price} />
      </Stat>
      <div className="gf-stat" style={{ fontSize: 12.5, color: "var(--gf-muted)", justifyContent: "center" }}>
        {tr("Inclus dans le prix des programmes — aucune vente séparée enregistrée.")}
      </div>
    </div>
  );
}

// Vente de billets hors programme (migration 037) : chiffre d'affaires,
// encaissé, reste, coût d'achat et marge.
function TicketSalesDetail({ s, Money, Bar, tr, revealed }) {
  const toCollect = s.due - s.paid;
  const margin = s.due - s.cost;
  return (
    <>
      <div>
        <SectionTitle
          icon="airplane_ticket"
          color="#6b3fc4"
          right={
            <Link href="/admin/billets" className="gf-card-link">
              {tr("Voir les ventes")}
            </Link>
          }
        >
          {tr("Ventes de billets hors programme")}
          <span style={{ fontWeight: 400, color: "var(--gf-subtle)" }}>
            {" "}
            · {tr.plural("{count} vente", "{count} ventes", s.count)} · {tr.plural("{count} émise", "{count} émises", s.issued)}
          </span>
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={tr("Chiffre d'affaires")}>
            <Money value={s.due} />
          </Stat>
          <Stat label={tr("Encaissé")} bg="color-mix(in oklch, var(--gf-accent) 8%, #fff)">
            <Money value={s.paid} color="var(--gf-accent)" />
          </Stat>
          <Stat
            label={!revealed ? tr("Solde") : toCollect < 0 ? tr("Trop-perçu") : tr("Reste à encaisser")}
            bg={!revealed ? undefined : toCollect > 0 ? "#fff8eb" : toCollect < 0 ? "#f0f5fe" : undefined}
          >
            <Money value={Math.abs(toCollect)} color={toCollect > 0 ? "#a35a00" : toCollect < 0 ? "#2b5cc4" : "var(--gf-text)"} />
          </Stat>
        </div>
        <Bar ratio={s.due > 0 ? s.paid / s.due : 0} color="var(--gf-accent)" />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: "var(--gf-border-soft)" }}>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>{tr("Coût d'achat des billets")}</span>
          <Money value={s.cost} large />
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>
            {tr("Marge")} <span style={{ color: "var(--gf-subtle)" }}>({tr("vente − achat")})</span>
          </span>
          <Money value={margin} large color={margin < 0 ? "#c4373b" : "var(--gf-accent)"} />
        </div>
      </div>
    </>
  );
}
