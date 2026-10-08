import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { campaignReport } from "@/lib/whatsapp/campaigns";
import PageHeader from "../../../_components/PageHeader";
import Icon from "../../../_components/Icon";
import AutoRefresh from "../../AutoRefresh";
import { StatusPill } from "../CampaignsManager";
import CampaignStopButton from "./CampaignStopButton";

export const dynamic = "force-dynamic";

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const fmt = (utc) => (utc ? new Date(`${String(utc).replace(" ", "T")}Z`).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", dateStyle: "short", timeStyle: "short" }) : "—");

// Rapport de campagne (CP-06) et liste des contacts ayant répondu.
export default async function CampaignReportPage({ params }) {
  const session = await getSession();
  if (!((await hasPermission(session, "whatsapp.campaigns")) || (await hasPermission(session, "whatsapp.campaigns.approve")))) {
    return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  }
  const { id } = await params;
  const { campaign: c, stats: s, ab, responders } = await campaignReport(Number(id));

  const kpis = [
    ["Destinataires", s.recipients],
    ["Envoyés", s.sent],
    ["Livrés", `${s.delivered} (${pct(s.delivered, s.sent)})`],
    ["Lus", `${s.read_count} (${pct(s.read_count, s.sent)})`],
    ["Réponses", `${s.replies} (${pct(s.replies, s.sent)})`],
    ["Inscriptions générées", s.registrations],
    ["Désinscriptions", s.unsubscribed],
    [s.cost_is_estimate ? "Coût (estimé)" : "Coût", `${s.cost.toFixed(2)} MAD`],
    ["Coût par inscription", s.cost_per_registration == null ? "—" : `${s.cost_per_registration} MAD`],
  ];

  return (
    <div className="space-y-6">
      {["validee", "en_cours"].includes(c.status) && <AutoRefresh seconds={20} />}
      <PageHeader icon="campaign" title={c.name} titleTranslate="no" description={`Template ${c.template_name}${c.template_b_name ? ` / ${c.template_b_name} (test A/B ${c.ab_test_percent} %)` : ""}`}>
        <StatusPill status={c.status} />
        {["validee", "en_cours"].includes(c.status) && <CampaignStopButton id={c.id} name={c.name} />}
        <Link href="/admin/whatsapp/campagnes" className="gf-btn-outline">
          <Icon name="arrow_back" size={16} />
          Campagnes
        </Link>
      </PageHeader>

      <div className="gf-card grid gap-3 p-5 text-sm sm:grid-cols-2">
        <p>{`Créée par ${c.created_by_name || "—"}`}</p>
        <p>{`Validée par ${c.approved_by_name || "—"} le ${fmt(c.approved_at)}`}</p>
        <p>{`Envoi prévu : ${c.scheduled_at ? fmt(c.scheduled_at) : "dès la validation"}`}</p>
        <p>{`Démarrée : ${fmt(c.started_at)} — terminée : ${fmt(c.finished_at)}`}</p>
        {c.stopped_at && <p className="text-red-700">{`Arrêt d'urgence par ${c.stopped_by_name || "—"} le ${fmt(c.stopped_at)}`}</p>}
        {s.pending > 0 && <p>{`${s.pending} message(s) en attente d'envoi`}</p>}
        {s.failed + s.skipped > 0 && <p>{`${s.failed} échec(s), ${s.skipped} contact(s) écarté(s) (consentement retiré, bloqué, template non approuvé)`}</p>}
      </div>

      <div className="gf-kpis">
        {kpis.map(([label, value]) => (
          <div key={label} className="gf-kpi">
            <span className="gf-kpi-label">{label}</span>
            <div className="gf-kpi-value" style={{ fontSize: 22 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {ab && (
        <div className="gf-card p-5 text-sm">
          <div className="gf-card-title mb-3">
            <Icon name="science" />
            Test A/B
          </div>
          <p>{`Critère : ${c.ab_metric === "lus" ? "taux de lecture" : "taux de réponse"} après ${c.ab_wait_hours} h.`}</p>
          <p>{`A (${c.template_name}) : ${Math.round(ab.A * 100)} % — B (${c.template_b_name}) : ${Math.round(ab.B * 100)} %`}</p>
          <p className="font-medium">{c.ab_winner ? `Gagnant : variante ${c.ab_winner}` : "Gagnant pas encore désigné."}</p>
        </div>
      )}

      <div className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <div className="gf-card-title">
            <Icon name="forum" />
            {`Contacts ayant répondu (${responders.length})`}
          </div>
          <a href={`/api/admin/whatsapp/campaigns/${c.id}?format=csv`} className="gf-card-link">
            <Icon name="download" size={16} />
            Exporter (CSV)
          </a>
        </div>
        {responders.length === 0 ? (
          <div className="gf-empty">Aucune réponse pour le moment.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Étape</th>
                <th>Variante</th>
                <th>Réponse</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {responders.map((r) => (
                <tr key={r.contact_id}>
                  <td translate="no">{r.profile_name || `+${r.phone}`}</td>
                  <td>{r.stage}</td>
                  <td>{r.variant}</td>
                  <td>{fmt(r.replied_at)}</td>
                  <td className="gf-actions">
                    <Link href={`/admin/whatsapp/conversations/${r.conversation_id}`}>Conversation</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
