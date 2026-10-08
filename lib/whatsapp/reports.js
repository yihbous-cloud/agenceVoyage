import { query } from "../db";
import { resolveAgencyId } from "../agencyContext";
import { buildDailyReport, localToday } from "./analytics";
import { getOpsSettings } from "./ops";
import { notify, localParts } from "./team";
import { sendMail } from "../mailer";

// Rapport quotidien (§8.2) : notification à la direction dans l'admin et,
// si des adresses sont saisies et le SMTP configuré, par e-mail. Envoyé une
// fois par jour à l'heure choisie (19h par défaut) par le worker ; le
// déclencheur interne « Rapport quotidien » (DC-10) appelle la même fonction.

export async function deliverDailyReport(explicitAgencyId, { force = false } = {}) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const ops = await getOpsSettings(agencyId);
  const today = localToday();
  const lastDay = ops.last_report_at ? localToday(new Date(`${ops.last_report_at.replace(" ", "T")}Z`)) : null;
  if (!force && lastDay === today) return { skipped: "déjà envoyé aujourd'hui" };
  const report = await buildDailyReport(agencyId);
  await notify({ team: "direction", kind: "rapport", title: report.title, body: report.text }, agencyId);
  let mail = { sent: false, reason: "aucun destinataire" };
  if (ops.report_emails) {
    const [agency] = await query(`SELECT name FROM agencies WHERE id = ?`, [agencyId]);
    mail = await sendMail({ to: ops.report_emails, subject: `${agency?.name || "Agence"} — ${report.title}`, text: report.text }).catch((e) => ({
      sent: false,
      reason: e.message,
    }));
  }
  await query(`UPDATE wa_ops_settings SET last_report_at = UTC_TIMESTAMP() WHERE agency_id = ?`, [agencyId]);
  return { report, mail };
}

// Agences dont le rapport est dû maintenant (worker, toutes les 5 minutes).
export async function listAgenciesDueForReport(now = new Date()) {
  const rows = await query(
    `SELECT a.agency_id FROM wa_accounts a -- agency-lint-ok: balayage worker de toutes les agences ayant WhatsApp
     WHERE a.status <> 'inactif'`
  );
  const { minutes } = localParts(now);
  const due = [];
  for (const { agency_id: agencyId } of rows) {
    const ops = await getOpsSettings(agencyId);
    if (!ops.report_enabled || minutes < ops.report_hour * 60) continue;
    const lastDay = ops.last_report_at ? localToday(new Date(`${ops.last_report_at.replace(" ", "T")}Z`)) : null;
    if (lastDay !== localToday(now)) due.push(agencyId);
  }
  return due;
}
