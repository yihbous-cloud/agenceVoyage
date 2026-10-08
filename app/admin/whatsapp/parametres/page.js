import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCurrentAgency } from "@/lib/currentAgency";
import { getAccountForAgency } from "@/lib/whatsapp/accounts";
import { listRecentMessages } from "@/lib/whatsapp/messages";
import { isEncryptionConfigured } from "@/lib/secrets";
import { getQueueHealth } from "@/lib/queue";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import WhatsAppAccountForm from "./WhatsAppAccountForm";
import OpsSettingsForm from "./OpsSettingsForm";
import { getOpsSettings, REPORT_SECTIONS } from "@/lib/whatsapp/ops";
import { listJobs } from "@/lib/systemJobs";
import { isMailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Paramètres WhatsApp (Lot 0, CLAUDE.md §3centquadragies) : identifiants Meta
// de l'agence, URL/jeton du webhook, état des services, derniers messages.
function webhookUrl(agencyBaseUrl) {
  const root = process.env.ROOT_DOMAIN;
  return `${root ? `https://${root}` : agencyBaseUrl}/api/webhooks/meta`;
}

function formatDateTime(value) {
  if (!value) return "—";
  // Dates stockées en UTC (MySQL), affichées à l'heure du Maroc.
  return new Date(`${String(value).replace(" ", "T")}Z`).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" });
}

const PROCESSING_TONE = {
  recu: { label: "Reçu", bg: "#e8f0fd", fg: "#2b5cc4" },
  en_cours: { label: "En cours", bg: "#fff4e0", fg: "#a35a00" },
  traite: { label: "Traité", bg: "#e6f4ee", fg: "#0f6b4b" },
  erreur: { label: "Erreur", bg: "#fdecec", fg: "#c4373b" },
  ignore: { label: "Ignoré", bg: "#f1f1ee", fg: "#5a5a60" },
};

const SEND_STATUS = {
  en_attente: "En attente",
  envoye: "Envoyé",
  livre: "Livré",
  lu: "Lu",
  echec: "Échec",
  recu: "Reçu",
};

function StatusRow({ ok, label, detail }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Icon name={ok ? "check_circle" : "block"} size={18} style={{ color: ok ? "#0f6b4b" : "#c4373b" }} />
      <div style={{ minWidth: 0 }}>
        <div className="font-medium">{label}</div>
        {detail && <div className="break-words text-xs text-zinc-500">{detail}</div>}
      </div>
    </li>
  );
}

export default async function WhatsAppSettingsPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.settings"))) {
    return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  }
  const [agency, account, health, ops, jobs, canData] = await Promise.all([
    getCurrentAgency(),
    getAccountForAgency(),
    getQueueHealth(),
    getOpsSettings(),
    listJobs(),
    hasPermission(session, "whatsapp.data"),
  ]);
  const messages = account ? await listRecentMessages(agency.id, 20) : [];
  const encryptionOk = isEncryptionConfigured();
  const heartbeatAge = health.workerHeartbeatAge;
  const workerOk = heartbeatAge != null && heartbeatAge < 60;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon="chat"
        title="WhatsApp — paramètres"
        description="Connexion du numéro WhatsApp Business de l'agence (WhatsApp Cloud API de Meta)."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="gf-card p-6 lg:col-span-2">
          <WhatsAppAccountForm account={account} webhookUrl={webhookUrl(agency.baseUrl)} encryptionOk={encryptionOk} />
        </div>

        <div className="gf-card p-6">
          <h2 className="gf-card-title">
            <Icon name="monitor_heart" size={18} />
            État des services
          </h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            <StatusRow
              ok={encryptionOk}
              label="Chiffrement des secrets"
              detail={encryptionOk ? "Clé maître configurée" : "SECRETS_ENCRYPTION_KEY absente du serveur"}
            />
            <StatusRow
              ok={Boolean(account?.has_access_token && account?.secrets_readable)}
              label="Compte WhatsApp"
              detail={
                !account
                  ? "Non configuré"
                  : account.secrets_readable
                  ? `${account.verified_name || account.display_phone || account.phone_number_id} — ${account.status}`
                  : "Secrets illisibles : à ressaisir"
              }
            />
            <StatusRow
              ok={account?.last_check_result === "OK"}
              label="Connexion à Meta"
              detail={
                account?.last_check_at
                  ? `${account.last_check_result} (${formatDateTime(account.last_check_at)})`
                  : "Jamais testée"
              }
            />
            <StatusRow
              ok={Boolean(account?.last_webhook_at)}
              label="Webhook"
              detail={account?.last_webhook_at ? `Dernier appel : ${formatDateTime(account.last_webhook_at)}` : "Aucun appel reçu"}
            />
            <StatusRow
              ok={health.redis}
              label="File d'attente (Redis)"
              detail={
                health.redis
                  ? `En attente : ${health.counts.waiting} · en cours : ${health.counts.active} · en échec : ${health.counts.failed}`
                  : "Redis injoignable — les messages restent en base et seront repris"
              }
            />
            <StatusRow
              ok={workerOk}
              label="Worker"
              detail={heartbeatAge != null ? `Dernier signal il y a ${heartbeatAge} s` : "Aucun signal (npm run worker)"}
            />
            {account?.quality_rating && (
              <StatusRow
                ok={account.quality_rating === "GREEN"}
                label="Note de qualité du numéro"
                detail={`${account.quality_rating}${account.messaging_tier ? ` · palier ${account.messaging_tier}` : ""}`}
              />
            )}
          </ul>
        </div>
      </div>

      <OpsSettingsForm
        initial={JSON.parse(JSON.stringify(ops))}
        jobs={JSON.parse(JSON.stringify(jobs))}
        sections={REPORT_SECTIONS}
        mailConfigured={isMailConfigured()}
        canData={canData}
      />

      {account && (
        <section className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <h2 className="gf-card-title">
              <Icon name="forum" size={18} />
              Derniers messages
            </h2>
          </div>
          {messages.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">Aucun message reçu pour l&apos;instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="gf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sens</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Contenu</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => {
                    const tone = PROCESSING_TONE[m.processing_status] || PROCESSING_TONE.recu;
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-xs">{formatDateTime(m.created_at)}</td>
                        <td>{m.direction === "entrant" ? "Reçu" : "Envoyé"}</td>
                        <td>
                          <div translate="no">{m.profile_name || "—"}</div>
                          <div className="gf-phone" translate="no" dir="ltr">
                            +{m.phone}
                          </div>
                        </td>
                        <td translate="no">
                          {m.type}
                          {m.media_stored > 0 && <span className="gf-chip ms-1">média</span>}
                        </td>
                        <td className="max-w-xs truncate" translate="no" title={m.content || ""}>
                          {m.content || "—"}
                        </td>
                        <td>
                          {m.direction === "entrant" ? (
                            <span className="gf-pill" style={{ background: tone.bg, color: tone.fg }} title={m.processing_error || ""}>
                              {tone.label}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500" title={m.error_message || ""}>
                              {SEND_STATUS[m.status] || m.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
