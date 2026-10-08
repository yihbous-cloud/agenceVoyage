import Link from "next/link";
import { getSession } from "@/lib/session";
import { listConversations, inboxScope } from "@/lib/whatsapp/conversations";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import AutoRefresh from "../AutoRefresh";
import { CONVERSATION_STATUS, PRIORITY, REASONS, TEAMS, formatDateTime } from "../labels";

export const dynamic = "force-dynamic";

const FILTERS = [
  ["ouvertes", "Ouvertes"],
  ["humain", "Humain"],
  ["ia", "IA"],
  ["copilote", "Copilote"],
  ["attente", "En attente"],
  ["resolu", "Résolues"],
];

// Inbox WhatsApp intégrée (décision du 07/10/2026, pas de Chatwoot).
export default async function ConversationsPage({ searchParams }) {
  const session = await getSession();
  const scope = await inboxScope(session);
  if (!scope) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const status = params.status || "ouvertes";
  const mine = params.mine === "1";
  const q = params.q || "";
  const rows = await listConversations(session, { status, mine, q: q || null });
  const qs = (extra) => {
    const p = new URLSearchParams({ status, ...(mine ? { mine: "1" } : {}), ...(q ? { q } : {}), ...extra });
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHeader
        icon="forum"
        title="Conversations WhatsApp"
        description={scope === "all" ? "Toutes les conversations de l'agence." : "Les conversations qui vous sont assignées ou à votre équipe."}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="gf-segmented">
          {FILTERS.map(([key, label]) => (
            <Link key={key} href={qs({ status: key })} data-active={status === key}>
              {label}
            </Link>
          ))}
        </div>
        <Link href={qs({ mine: mine ? "" : "1" })} className="gf-btn-outline" data-active={mine}>
          <Icon name="person" size={16} />
          {mine ? "Toutes" : "Les miennes"}
        </Link>
        <form className="gf-search" style={{ minWidth: 240 }}>
          <Icon name="search" size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="Nom ou numéro" />
          <input type="hidden" name="status" value={status} />
          {mine && <input type="hidden" name="mine" value="1" />}
        </form>
      </div>

      <div className="gf-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="gf-empty">Aucune conversation.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Dernier message</th>
                  <th>Statut</th>
                  <th>Motif / équipe</th>
                  <th>Délai</th>
                  <th>Activité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const st = CONVERSATION_STATUS[c.status] || CONVERSATION_STATUS.ia;
                  const pr = PRIORITY[c.priority];
                  const late = c.status === "humain" && !c.first_human_reply_at && Boolean(c.sla_late);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/whatsapp/conversations/${c.id}`} className="font-medium hover:underline">
                          <span translate="no">{c.traveler_name || c.profile_name || `+${c.phone}`}</span>
                        </Link>
                        <div className="gf-phone" dir="ltr" translate="no">+{c.phone}</div>
                      </td>
                      <td className="max-w-xs">
                        <div className="truncate text-sm" translate="no" title={c.last_message || ""}>
                          {c.last_direction === "sortant" ? "↪ " : ""}
                          {c.last_message || "—"}
                        </div>
                        {Number(c.drafts) > 0 && <span className="gf-chip">brouillon IA à valider</span>}
                      </td>
                      <td>
                        <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                        {pr && c.priority !== "normale" && (
                          <span className="gf-pill ms-1" style={{ background: pr.bg, color: pr.fg }}>{pr.label}</span>
                        )}
                      </td>
                      <td className="text-sm">
                        <div>{c.transfer_reason ? REASONS[c.transfer_reason] || c.transfer_reason : "—"}</div>
                        <div className="text-xs text-zinc-500">
                          {c.assigned_name ? <span translate="no">{c.assigned_name}</span> : c.team ? TEAMS[c.team] || c.team : ""}
                        </div>
                      </td>
                      <td className="text-xs">
                        {c.status === "humain" && !c.first_human_reply_at && c.sla_due_at ? (
                          <span style={{ color: late ? "#c4373b" : undefined, fontWeight: late ? 600 : 400 }}>
                            {late ? "Dépassé" : "Avant"} {formatDateTime(c.sla_due_at)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(c.last_activity_at || c.opened_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
