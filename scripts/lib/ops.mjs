import mysql from "mysql2/promise";
import { sendMail } from "../../lib/mailer.js";

// Outils communs aux scripts d'exploitation (sauvegarde, restauration,
// contrôle de santé) : connexion MySQL, suivi dans system_jobs, alertes.

export function dbConfig(overrides = {}) {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "golden_fantastic",
    dateStrings: true,
    ...overrides,
  };
}

export async function recordSystemJob(name, status, message = null, details = null) {
  const conn = await mysql.createConnection(dbConfig());
  try {
    await conn.execute(
      `INSERT INTO system_jobs (name, last_run_at, last_status, last_message, details) VALUES (?, UTC_TIMESTAMP(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), last_message = VALUES(last_message), details = VALUES(details)`,
      [name, status, message ? String(message).slice(0, 500) : null, details ? JSON.stringify(details) : null]
    );
  } finally {
    await conn.end();
  }
}

// Alerte technique au super admin (NF-05) : ALERT_EMAILS + adresses
// d'alerte saisies par les agences dans leurs réglages WhatsApp.
export async function alert(subject, text) {
  const recipients = new Set(String(process.env.ALERT_EMAILS || "").split(/[,;\s]+/).filter(Boolean));
  try {
    const conn = await mysql.createConnection(dbConfig());
    const [rows] = await conn.query(`SELECT alert_emails FROM wa_ops_settings WHERE alert_emails IS NOT NULL -- agency-lint-ok: alertes techniques globales`);
    await conn.end();
    for (const r of rows) for (const e of String(r.alert_emails).split(/[,;\s]+/).filter(Boolean)) recipients.add(e);
  } catch {
    // base indisponible : on se contente d'ALERT_EMAILS
  }
  if (!recipients.size) {
    console.warn(`[alerte] aucun destinataire configuré : ${subject}`);
    return { sent: false };
  }
  return sendMail({ to: [...recipients], subject: `[Alerte serveur] ${subject}`, text });
}
