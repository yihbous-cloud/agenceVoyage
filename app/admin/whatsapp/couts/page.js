import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { costsData, localToday, shiftDay } from "@/lib/whatsapp/analytics";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import WaPeriodFilter from "../_components/WaPeriodFilter";
import Bars from "../_components/Bars";

export const dynamic = "force-dynamic";

const mad = (v) => `${Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const usd = (v) => `${Number(v || 0).toFixed(Number(v) < 1 ? 4 : 2)} $`;
const CATEGORY = { marketing: "Marketing", utility: "Utilité", authentication: "Authentification", service: "Service (gratuit)", referral_conversion: "Pub click-to-WhatsApp (gratuit)", "non communiqué": "Non communiqué par Meta" };
const CONTEXT = { conversation: "Conversations", resume: "Résumés", bac_a_sable: "Bac à sable", test: "Jeu de tests" };

// Coûts Meta et Claude (cahier §8.3).
export default async function CostsPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.costs"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const today = localToday();
  const c = await costsData({ from: params?.from || shiftDay(today, -29), to: params?.to || today });
  const capRatio = c.cap.monthlyCapUsd ? c.cap.monthCostUsd / c.cap.monthlyCapUsd : null;
  const freeShare = c.free.total ? (c.free.freeWindow + c.free.freeTemplates) / c.free.total : null;

  return (
    <div className="space-y-6">
      <PageHeader icon="savings" title="Coûts Meta et Claude" description="Coût réel des messages facturés par Meta (tarifs saisis dans les paramètres WhatsApp) et des appels à l'IA Claude.">
        <WaPeriodFilter from={c.period.from} to={c.period.to} today={today} />
      </PageHeader>

      <div className="gf-kpis">
        <div className="gf-kpi">
          <span className="gf-kpi-label">Coût total (MAD)</span>
          <div className="gf-kpi-value">{mad(c.totalMad)}</div>
        </div>
        <div className="gf-kpi">
          <span className="gf-kpi-label">Meta (messages facturés)</span>
          <div className="gf-kpi-value">{mad(c.meta.total)}</div>
        </div>
        <div className="gf-kpi">
          <span className="gf-kpi-label">Claude (IA)</span>
          <div className="gf-kpi-value">{usd(c.claude.usd)}</div>
          <span className="text-xs text-zinc-500">{`≈ ${mad(c.claude.mad)} (1 $ = ${c.prices.usdToMad} MAD)`}</span>
        </div>
        <div className="gf-kpi">
          <span className="gf-kpi-label">Coût par inscription</span>
          <div className="gf-kpi-value">{c.costPerRegistration == null ? "—" : mad(c.costPerRegistration)}</div>
        </div>
      </div>

      <div className="gf-card p-5">
        <div className="gf-card-title mb-3">
          <Icon name="warning" />
          Plafond mensuel Claude
        </div>
        {c.cap.monthlyCapUsd == null ? (
          <p className="text-sm text-zinc-600">
            Aucun plafond défini. <Link href="/admin/whatsapp/ia">Le définir dans les réglages de l&apos;agent IA</Link>.
          </p>
        ) : (
          <>
            <p className="text-sm">{`${usd(c.cap.monthCostUsd)} dépensés ce mois sur ${usd(c.cap.monthlyCapUsd)} (${Math.round(capRatio * 100)} %) — alerte à ${c.cap.alertPercent} %.`}</p>
            <div className="gf-progress mt-2">
              <span style={{ width: `${Math.min(100, capRatio * 100)}%`, background: capRatio >= 1 ? "var(--gf-danger)" : capRatio * 100 >= c.cap.alertPercent ? "var(--gf-warning)" : "var(--gf-accent)" }} />
            </div>
          </>
        )}
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="chat" />
              Meta par catégorie
            </div>
          </div>
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th className="gf-num">Messages</th>
                <th className="gf-num">Coût</th>
              </tr>
            </thead>
            <tbody>
              {c.meta.byCategory.map((r) => (
                <tr key={r.category}>
                  <td>{CATEGORY[r.category] || r.category}</td>
                  <td className="gf-num">{r.messages}</td>
                  <td className="gf-num">{mad(r.cost)}</td>
                </tr>
              ))}
              {c.meta.byCategory.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-zinc-500">
                    Aucun message envoyé sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-5 pb-4 pt-2 text-xs text-zinc-500">
            {`Messages gratuits : ${freeShare == null ? "—" : `${Math.round(freeShare * 100)} %`} (fenêtre de 24h et templates non facturés) · ${c.free.adConversations} conversation(s) ouverte(s) depuis une pub (72h gratuites).`}
          </div>
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="description" />
              Meta par template et par campagne
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {c.meta.byTemplate.map((r) => (
                <tr key={`t-${r.name}`}>
                  <td className="font-mono text-xs" translate="no">{r.name}</td>
                  <td className="gf-num">{r.messages}</td>
                  <td className="gf-num">{mad(r.cost)}</td>
                </tr>
              ))}
              {c.meta.byCampaign.map((r) => (
                <tr key={`c-${r.id}`}>
                  <td>
                    <Icon name="campaign" size={14} />{" "}
                    <Link href={`/admin/whatsapp/campagnes/${r.id}`} translate="no">
                      {r.name}
                    </Link>
                  </td>
                  <td className="gf-num">{r.messages}</td>
                  <td className="gf-num">{mad(r.cost)}</td>
                </tr>
              ))}
              {c.meta.byTemplate.length + c.meta.byCampaign.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-zinc-500">
                    Aucun template envoyé sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card p-5">
          <div className="gf-card-title mb-4">
            <Icon name="smart_toy" />
            Claude par jour
          </div>
          <Bars series={c.claude.byDay.map((d) => ({ label: d.day.slice(8, 10), value: d.cost_usd }))} />
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="smart_toy" />
              Claude par modèle
            </div>
          </div>
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Modèle</th>
                <th>Usage</th>
                <th className="gf-num">Appels</th>
                <th className="gf-num">Coût</th>
              </tr>
            </thead>
            <tbody>
              {c.claude.byModel.map((r) => (
                <tr key={`${r.model}-${r.context}`}>
                  <td className="font-mono text-xs" translate="no">{r.model}</td>
                  <td>{CONTEXT[r.context] || r.context}</td>
                  <td className="gf-num">{r.calls}</td>
                  <td className="gf-num">{usd(r.cost_usd)}</td>
                </tr>
              ))}
              {c.claude.byModel.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-zinc-500">
                    Aucun appel à Claude sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-5 pb-4 pt-2 text-xs text-zinc-500">Transcription des vocaux : aucun fournisseur configuré (0 $).</div>
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="forum" />
              Conversations les plus coûteuses (Claude)
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {c.claude.topConversations.map((r) => (
                <tr key={r.conversation_id}>
                  <td>
                    <Link href={`/admin/whatsapp/conversations/${r.conversation_id}`} translate="no">
                      {r.profile_name || `+${r.phone}`}
                    </Link>
                  </td>
                  <td className="gf-num">{`${r.calls} appel(s)`}</td>
                  <td className="gf-num">{usd(r.cost_usd)}</td>
                </tr>
              ))}
              {c.claude.topConversations.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucune conversation.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="mosque" />
              Inscriptions via WhatsApp par programme
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {c.registrations.map((r) => (
                <tr key={r.program}>
                  <td translate="no">{r.program}</td>
                  <td className="gf-num">{r.registrations}</td>
                  <td className="gf-num">{c.costPerRegistration == null ? "—" : mad(c.costPerRegistration * r.registrations)}</td>
                </tr>
              ))}
              {c.registrations.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucune inscription issue de WhatsApp sur la période.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-5 pb-4 pt-2 text-xs text-zinc-500">Coût attribué au programme = coût par inscription × inscriptions du programme (coût total de la période réparti à parts égales).</div>
        </div>
      </div>
    </div>
  );
}
