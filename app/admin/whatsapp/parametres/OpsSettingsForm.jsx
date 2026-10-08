"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import { useConfirm } from "../../_components/useConfirm";
import { formatDateTime } from "../labels";

const JOB_LABELS = { sauvegarde: "Sauvegarde chiffrée (nuit)", test_restauration: "Test de restauration", sante: "Contrôle de santé (5 min)", purge: "Purge des données (nuit)" };

// Exploitation (cahier §8.17) : tarifs Meta, rapport quotidien, alertes,
// conservation des données (NF-13), état des tâches planifiées.
export default function OpsSettingsForm({ initial, jobs, sections, mailConfigured, canData }) {
  const [s, setS] = useState(initial);
  const [message, setMessage] = useState(null);
  const [purge, setPurge] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const set = (patch) => setS((x) => ({ ...x, ...patch }));

  async function post(body) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action impossible");
      return data;
    } catch (e) {
      setMessage({ ok: false, text: e.message });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const num = (key, label, props = {}) => (
    <label className="block text-sm">
      {label}
      <input type="number" step="any" value={s[key]} onChange={(e) => set({ [key]: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" {...props} />
    </label>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = await post({ action: "save", settings: s });
        if (data) {
          setS(data.settings);
          setMessage({ ok: true, text: "Réglages enregistrés." });
        }
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="gf-card space-y-3 p-5">
          <h2 className="gf-card-title">
            <Icon name="savings" size={18} />
            Tarifs Meta (calcul des coûts)
          </h2>
          <p className="text-xs text-zinc-500">Prix d&apos;un message facturé par Meta, en dirhams (grille tarifaire Meta pour le Maroc). Les messages de service (fenêtre 24h) et les 72h des pubs sont gratuits.</p>
          <div className="grid grid-cols-2 gap-3">
            {num("price_marketing_mad", "Marketing (MAD)")}
            {num("price_utility_mad", "Utilité (MAD)")}
            {num("price_authentication_mad", "Authentification (MAD)")}
            {num("usd_to_mad", "Taux 1 $ → MAD (Claude)")}
          </div>
          {num("cost_alert_percent", "Alerte coût Claude à (% du plafond mensuel)", { min: 1, max: 100 })}
        </section>

        <section className="gf-card space-y-3 p-5">
          <h2 className="gf-card-title">
            <Icon name="schedule" size={18} />
            Rapport quotidien
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.report_enabled} onChange={(e) => set({ report_enabled: e.target.checked })} />
            Envoyer le rapport chaque jour à
            <input type="number" min={0} max={23} value={s.report_hour} onChange={(e) => set({ report_hour: e.target.value })} className="w-16 rounded-md border px-2 py-1" />h
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(sections).map(([k, label]) => {
              const on = s.report_sections.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className="gf-chip"
                  style={on ? { background: "var(--gf-accent-soft)", color: "var(--gf-accent-ink)", borderColor: "var(--gf-accent)" } : undefined}
                  onClick={() => set({ report_sections: on ? s.report_sections.filter((x) => x !== k) : [...s.report_sections, k] })}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="block text-sm">
            Destinataires e-mail (séparés par des virgules)
            <input value={s.report_emails || ""} onChange={(e) => set({ report_emails: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" dir="ltr" />
          </label>
          <label className="block text-sm">
            Alertes techniques (panne, sauvegarde) — e-mails
            <input value={s.alert_emails || ""} onChange={(e) => set({ alert_emails: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" dir="ltr" />
          </label>
          <p className="text-xs text-zinc-500">
            {mailConfigured ? "Envoi d'e-mails configuré." : "SMTP non configuré sur le serveur : le rapport n'est visible que dans les notifications de l'admin."}
            {s.last_report_at ? ` Dernier rapport : ${formatDateTime(s.last_report_at)}.` : ""}
          </p>
          <button
            type="button"
            className="gf-btn-outline"
            disabled={busy}
            onClick={async () => {
              const data = await post({ action: "report_now" });
              if (data) setReport(data);
            }}
          >
            Générer le rapport maintenant
          </button>
          {report && (
            <pre className="whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs">
              {report.text}
              {report.mail?.sent ? "\n\n✓ envoyé par e-mail" : ""}
            </pre>
          )}
        </section>
      </div>

      {canData && (
        <section className="gf-card space-y-3 p-5">
          <h2 className="gf-card-title">
            <Icon name="shield" size={18} />
            Conservation des données (loi 09-08)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {num("retention_documents_days_after_trip", "Copies de documents : jours après le retour du voyage", { min: 1 })}
            {num("retention_media_days", "Autres médias (vocaux, photos) : jours", { min: 7 })}
            {num("retention_conversations_months", "Conversations résolues : mois", { min: 1 })}
            {num("retention_ia_logs_days", "Journaux IA : jours", { min: 7 })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.purge_enabled} onChange={(e) => set({ purge_enabled: e.target.checked })} />
            Purge automatique chaque nuit (entre 2h et 4h)
          </label>
          <p className="text-xs text-zinc-500">
            Le dossier de voyage du CRM (inscription, paiements, passeport saisi) n&apos;est jamais purgé : seules les données WhatsApp le sont.
            {s.last_purge_at ? ` Dernière purge : ${formatDateTime(s.last_purge_at)} — ${s.last_purge_result || ""}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="gf-btn-outline"
              disabled={busy}
              onClick={async () => {
                const data = await post({ action: "purge_preview" });
                if (data) setPurge(data);
              }}
            >
              Simuler la purge (avec les durées enregistrées)
            </button>
            <button
              type="button"
              className="gf-btn-outline"
              style={{ color: "var(--gf-danger)" }}
              disabled={busy}
              onClick={async () => {
                if (!(await confirm("Lancer la purge maintenant ? Les fichiers et conversations au-delà des durées de conservation seront supprimés définitivement."))) return;
                const data = await post({ action: "purge_now" });
                if (data) setPurge(data);
              }}
            >
              Purger maintenant
            </button>
          </div>
          {purge && (
            <p className="text-sm">
              {`${purge.dryRun ? "Seraient supprimés" : "Supprimés"} : ${purge.documents} copie(s) de documents, ${purge.media} média(s), ${purge.conversations} conversation(s), ${purge.iaLogs} journal(aux) IA.`}
            </p>
          )}
        </section>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="gf-btn-primary" disabled={busy}>
          Enregistrer les réglages d&apos;exploitation
        </button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>

      <section className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <h2 className="gf-card-title">
            <Icon name="monitor_heart" size={18} />
            Tâches planifiées du serveur
          </h2>
        </div>
        {jobs.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500">Aucune exécution enregistrée (sauvegarde et contrôle de santé lancés par PM2 en production).</p>
        ) : (
          <table className="gf-table w-full">
            <tbody>
              {jobs.map((j) => (
                <tr key={j.name}>
                  <td>{JOB_LABELS[j.name] || j.name}</td>
                  <td>
                    <span
                      className="gf-pill"
                      style={j.last_status === "ok" ? { background: "#e6f4ee", color: "#0f6b4b" } : j.last_status === "erreur" ? { background: "#fdecec", color: "#c4373b" } : { background: "#fff4e0", color: "#a35a00" }}
                    >
                      {j.last_status === "ok" ? "OK" : j.last_status === "erreur" ? "Échec" : "En cours"}
                    </span>
                  </td>
                  <td>{formatDateTime(j.last_run_at)}</td>
                  <td className="text-xs" translate="no">{j.last_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {confirmDialog}
    </form>
  );
}
