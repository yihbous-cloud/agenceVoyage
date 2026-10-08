import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTasks, listNotificationsForStaff } from "@/lib/whatsapp/team";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import AutoRefresh from "../AutoRefresh";
import TaskActions from "./TaskActions";
import { formatDateTime, TEAMS } from "../labels";

export const dynamic = "force-dynamic";

const TYPES = {
  validation_paiement: "Reçu de paiement à valider",
  rappel: "Rappel téléphonique",
  document: "Document à vérifier",
  autre: "Autre",
};

const KIND_ICONS = { urgence: "warning", sla: "hourglass_top", sla_escalade: "warning", transfert: "support_agent", brouillon: "smart_toy", message: "chat", tache: "task_alt", plafond_ia: "warning" };

function details(task) {
  const d = typeof task.details === "string" ? JSON.parse(task.details || "{}") : task.details || {};
  return Object.entries(d)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k} : ${v}`)
    .join(" · ");
}

// Tâches créées par l'agent (reçus, rappels, documents) et notifications.
export default async function TasksPage({ searchParams }) {
  const session = await getSession();
  const canTasks = await hasPermission(session, "whatsapp.tasks");
  const canInbox = (await hasPermission(session, "whatsapp.conversations.all")) || (await hasPermission(session, "whatsapp.conversations.own"));
  if (!canTasks && !canInbox) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const status = params.status === "faite" ? "faite" : "ouverte";
  const [tasks, notifications] = await Promise.all([canTasks ? listTasks(session, { status }) : [], listNotificationsForStaff(session, { limit: 40 })]);
  const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);

  return (
    <div className="max-w-6xl space-y-6">
      <AutoRefresh seconds={20} />
      <PageHeader icon="task_alt" title="Tâches et alertes WhatsApp" description="Reçus de paiement à valider, rappels demandés par les clients, documents reçus, alertes de délai et d'urgence." />

      <div className="grid gap-6 lg:grid-cols-3">
        {canTasks && (
          <section className="gf-card overflow-hidden lg:col-span-2">
            <div className="gf-card-head gf-divided">
              <h2 className="gf-card-title">
                <Icon name="task_alt" size={18} />
                Tâches
              </h2>
              <div className="gf-segmented">
                <Link href="?status=ouverte" data-active={status === "ouverte"}>
                  À faire
                </Link>
                <Link href="?status=faite" data-active={status === "faite"}>
                  Faites
                </Link>
              </div>
            </div>
            {tasks.length === 0 ? (
              <div className="gf-empty">Aucune tâche.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div style={{ minWidth: 0 }}>
                      <div className="font-medium">{TYPES[t.type] || t.type}</div>
                      <div translate="no">{t.title}</div>
                      <div className="text-xs text-zinc-500">
                        {details(t) && <span translate="no">{details(t)} · </span>}
                        {t.contact_name || t.contact_phone ? <span translate="no">{t.contact_name || `+${t.contact_phone}`} · </span> : ""}
                        {t.assigned_name ? <span translate="no">{t.assigned_name}</span> : t.team ? TEAMS[t.team] || t.team : ""} · {formatDateTime(t.created_at)}
                        {t.done_by_name && <> · fait par <span translate="no">{t.done_by_name}</span></>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        {t.conversation_id && (
                          <Link href={`/admin/whatsapp/conversations/${t.conversation_id}`} className="text-emerald-700 hover:underline">
                            Ouvrir la conversation
                          </Link>
                        )}
                        {t.media_id && (
                          <a href={`/api/admin/whatsapp/media/${t.media_id}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                            Voir le document
                          </a>
                        )}
                      </div>
                    </div>
                    <TaskActions id={t.id} status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="gf-card h-fit overflow-hidden">
          <div className="gf-card-head gf-divided">
            <h2 className="gf-card-title">
              <Icon name="notifications" size={18} />
              Alertes
            </h2>
            {unread.length > 0 && <TaskActions markRead={unread} />}
          </div>
          {notifications.length === 0 ? (
            <div className="gf-empty">Aucune alerte.</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <li key={n.id} className={`px-4 py-2 text-sm ${n.read_at ? "text-zinc-500" : ""}`}>
                  <div className="flex items-start gap-2">
                    <Icon name={KIND_ICONS[n.kind] || "notifications"} size={16} style={{ color: n.kind === "urgence" ? "#c4373b" : undefined }} />
                    <div style={{ minWidth: 0 }}>
                      {n.conversation_id ? (
                        <Link href={`/admin/whatsapp/conversations/${n.conversation_id}`} className={n.read_at ? "" : "font-medium"} translate="no">
                          {n.title}
                        </Link>
                      ) : (
                        <span className={n.read_at ? "" : "font-medium"} translate="no">{n.title}</span>
                      )}
                      {n.body && <div className="truncate text-xs text-zinc-500" translate="no">{n.body}</div>}
                      <div className="text-[11px] text-zinc-400">{formatDateTime(n.created_at)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
