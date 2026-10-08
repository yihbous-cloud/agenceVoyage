import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { statisticsData, localToday, shiftDay } from "@/lib/whatsapp/analytics";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import WaPeriodFilter from "../_components/WaPeriodFilter";
import { REASONS as TRANSFER_REASONS } from "../labels";

export const dynamic = "force-dynamic";

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "—");

function Funnel({ title, icon, rows }) {
  return (
    <div className="gf-card overflow-hidden">
      <div className="gf-card-head gf-divided">
        <div className="gf-card-title">
          <Icon name={icon} />
          {title}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="gf-empty">Aucun contact sur la période.</div>
      ) : (
        <table className="gf-table w-full">
          <thead>
            <tr>
              <th></th>
              <th className="gf-num">Contacts</th>
              <th className="gf-num">Qualifiés</th>
              <th className="gf-num">Transférés</th>
              <th className="gf-num">Inscrits</th>
              <th className="gf-num">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td translate="no">{r.label}</td>
                <td className="gf-num">{r.contacts}</td>
                <td className="gf-num">{r.qualified}</td>
                <td className="gf-num">{r.transferred}</td>
                <td className="gf-num">{r.registered}</td>
                <td className="gf-num">{pct(r.registered, r.contacts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Statistiques détaillées (cahier §8.2).
export default async function StatisticsPage({ searchParams }) {
  const session = await getSession();
  const allowed =
    (await hasPermission(session, "whatsapp.costs")) || (await hasPermission(session, "whatsapp.campaigns")) || (await hasPermission(session, "whatsapp.conversations.all"));
  if (!allowed) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const today = localToday();
  const s = await statisticsData({ from: params?.from || shiftDay(today, -29), to: params?.to || today });
  const totalReasons = s.reasons.reduce((t, r) => t + r.n, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon="bar_chart" title="Statistiques WhatsApp" description="Entonnoirs de conversion, motifs de transfert, questions sans réponse, performance des templates et des campagnes.">
        <WaPeriodFilter from={s.period.from} to={s.period.to} today={today} />
      </PageHeader>

      <div className="gf-grid-cards">
        <Funnel title="Entonnoir par source" icon="qr_code_2" rows={s.bySource} />
        <Funnel title="Entonnoir par programme" icon="mosque" rows={s.byProgram} />
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="support_agent" />
            Motifs de transfert
          </div>
          {s.reasons.length === 0 ? (
            <div className="gf-empty">Aucun transfert sur la période.</div>
          ) : (
            <div className="space-y-2">
              {s.reasons.map((r) => (
                <div key={r.reason}>
                  <div className="flex justify-between text-sm">
                    <span>{TRANSFER_REASONS[r.reason] || r.reason}</span>
                    <span className="text-zinc-500">{`${r.n} (${pct(r.n, totalReasons)})`}</span>
                  </div>
                  <div className="gf-progress mt-1">
                    <span style={{ width: `${(r.n / totalReasons) * 100}%`, background: "var(--gf-accent)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="help" />
              Questions sans réponse dans la base
            </div>
            <Link href="/admin/whatsapp/connaissances" className="gf-card-link">
              Base de connaissances
            </Link>
          </div>
          {s.unanswered.length === 0 ? (
            <div className="gf-empty">Aucune question en attente.</div>
          ) : (
            <table className="gf-table w-full">
              <tbody>
                {s.unanswered.map((q, i) => (
                  <tr key={i}>
                    <td translate="no" dir="auto">{q.question}</td>
                    <td className="gf-num">{q.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="smart_toy" />
            Sujets traités par l&apos;IA (outils appelés)
          </div>
          {s.tools.length === 0 ? (
            <div className="gf-empty">Aucune activité de l&apos;IA sur la période.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {s.tools.map((t) => (
                <span key={t.name} className="gf-chip">
                  <span translate="no">{t.name}</span> · {t.n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="thumb_up" />
            Satisfaction après voyage
          </div>
          <p className="text-sm">{`${s.satisfaction.sent} questionnaire(s) envoyé(s), ${s.satisfaction.answered} réponse(s) (${pct(s.satisfaction.answered, s.satisfaction.sent)})`}</p>
          <p className="mt-1 text-xs text-zinc-500">Réponses au template gf_avis_satisfaction dans les 7 jours.</p>
        </div>
      </div>

      <div className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <div className="gf-card-title">
            <Icon name="description" />
            Performance des templates
          </div>
        </div>
        {s.templates.length === 0 ? (
          <div className="gf-empty">Aucun template envoyé sur la période.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Template</th>
                <th className="gf-num">Envoyés</th>
                <th className="gf-num">Livrés</th>
                <th className="gf-num">Lus</th>
                <th className="gf-num">Réponses (3 j)</th>
                <th className="gf-num">Échecs</th>
              </tr>
            </thead>
            <tbody>
              {s.templates.map((t) => (
                <tr key={t.name}>
                  <td className="font-mono text-xs" translate="no">{t.name}</td>
                  <td className="gf-num">{t.sent}</td>
                  <td className="gf-num">{pct(t.delivered, t.sent)}</td>
                  <td className="gf-num">{pct(t.read_count, t.sent)}</td>
                  <td className="gf-num">{pct(t.replies, t.sent)}</td>
                  <td className="gf-num">{t.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <div className="gf-card-title">
            <Icon name="campaign" />
            Campagnes lancées sur la période
          </div>
          <Link href="/admin/whatsapp/campagnes" className="gf-card-link">
            Toutes les campagnes
          </Link>
        </div>
        {s.campaigns.length === 0 ? (
          <div className="gf-empty">Aucune campagne sur la période.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Campagne</th>
                <th className="gf-num">Envoyés</th>
                <th className="gf-num">Livrés</th>
                <th className="gf-num">Lus</th>
              </tr>
            </thead>
            <tbody>
              {s.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/whatsapp/campagnes/${c.id}`} translate="no">
                      {c.name}
                    </Link>
                  </td>
                  <td className="gf-num">{c.sent}</td>
                  <td className="gf-num">{pct(c.delivered, c.sent)}</td>
                  <td className="gf-num">{pct(c.read_count, c.sent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
