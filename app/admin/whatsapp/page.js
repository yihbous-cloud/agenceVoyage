import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { inboxScope } from "@/lib/whatsapp/conversations";
import { dashboardData, localToday } from "@/lib/whatsapp/analytics";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";
import WaPeriodFilter from "./_components/WaPeriodFilter";
import Bars from "./_components/Bars";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";

const ALERT_TONE = {
  danger: { bg: "var(--gf-danger-soft)", fg: "var(--gf-danger)", icon: "warning" },
  warning: { bg: "var(--gf-warning-soft)", fg: "var(--gf-warning)", icon: "info" },
};

function duration(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

// Tableau de bord WhatsApp (cahier §8.1).
export default async function WhatsappDashboardPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.dashboard"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const scope = (await inboxScope(session)) === "all" ? "all" : "own";
  const d = await dashboardData({ scope, session, period: { from: params?.from, to: params?.to } });
  const today = localToday();

  const kpis = [
    { label: "Conversations", value: d.counters.conversations, icon: "forum", tone: "var(--gf-info)", soft: "var(--gf-info-soft)", href: "/admin/whatsapp/conversations" },
    { label: "Nouveaux contacts", value: d.counters.new_contacts, icon: "person_add", tone: "var(--gf-accent)", soft: "var(--gf-accent-soft)", href: "/admin/whatsapp/contacts" },
    { label: "Prospects qualifiés", value: d.counters.qualified, icon: "verified", tone: "var(--gf-violet)", soft: "var(--gf-violet-soft)", href: "/admin/whatsapp/contacts?stage=qualifie" },
    { label: "Transferts en attente", value: d.counters.pending_transfers, icon: "hourglass_top", tone: "var(--gf-warning)", soft: "var(--gf-warning-soft)", href: "/admin/whatsapp/conversations" },
    { label: "Inscriptions via WhatsApp", value: d.counters.registrations_whatsapp, icon: "how_to_reg", tone: "var(--gf-accent)", soft: "var(--gf-accent-soft)", href: "/admin/inscriptions" },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={60} />
      <PageHeader
        icon="insights"
        title="Tableau de bord WhatsApp"
        description={scope === "all" ? "Vue de l'agence sur la période choisie." : "Vue limitée à votre équipe et à vos conversations."}
      >
        <WaPeriodFilter from={d.period.from} to={d.period.to} today={today} />
      </PageHeader>

      {d.alerts.length > 0 && (
        <div className="space-y-2">
          {d.alerts.map((a, i) => {
            const t = ALERT_TONE[a.level] || ALERT_TONE.warning;
            return (
              <Link key={i} href={a.href} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm" style={{ background: t.bg, color: t.fg }}>
                <Icon name={t.icon} size={18} fill />
                <span>{a.text}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="gf-kpis">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="gf-kpi">
            <div className="flex items-center justify-between">
              <span className="gf-kpi-label">{k.label}</span>
              <span className="gf-kpi-icon" style={{ background: k.soft, color: k.tone }}>
                <Icon name={k.icon} size={18} fill />
              </span>
            </div>
            <div className="gf-kpi-value">{k.value}</div>
          </Link>
        ))}
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="schedule" />
            Messages entrants par heure
          </div>
          <Bars series={d.hourly.map((h) => ({ label: `${h.hour}h`, value: h.count }))} labelEvery={3} />
        </div>
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="calendar_month" />
            Messages par jour (14 jours)
          </div>
          <Bars
            series={d.daily.map((x) => ({ label: x.day.slice(8, 10), value: x.inbound, value2: x.outbound }))}
            legend={
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--gf-accent, #0f6b4b)" }} />
                  Entrants
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#c9a24a" }} />
                  Sortants
                </span>
              </>
            }
          />
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="smart_toy" />
            Qualité de prise en charge
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="gf-stat">
              <span className="gf-stat-label">Taux de résolution par l&apos;IA</span>
              <span className="gf-stat-value">{d.aiResolutionRate == null ? "—" : `${Math.round(d.aiResolutionRate * 100)} %`}</span>
              <span className="text-xs text-zinc-500">{`sur ${d.aiHandled} conversation(s) traitée(s) par l'IA`}</span>
            </div>
            <div className="gf-stat">
              <span className="gf-stat-label">Délai moyen de première réponse humaine</span>
              <span className="gf-stat-value">{duration(d.avgFirstHumanReplySeconds)}</span>
              <span className="text-xs text-zinc-500">après transfert</span>
            </div>
          </div>
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="support_agent" />
              Classement des conseillers
            </div>
          </div>
          {d.advisors.length === 0 ? (
            <div className="gf-empty">Aucune conversation transférée sur la période.</div>
          ) : (
            <table className="gf-table w-full">
              <thead>
                <tr>
                  <th>Conseiller</th>
                  <th className="gf-num">Conversations</th>
                  <th className="gf-num">Délai de réponse</th>
                  <th className="gf-num">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {d.advisors.map((a) => (
                  <tr key={a.id}>
                    <td translate="no">{a.full_name}</td>
                    <td className="gf-num">{a.conversations}</td>
                    <td className="gf-num">{duration(a.avg_reply_seconds)}</td>
                    <td className="gf-num">{a.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
