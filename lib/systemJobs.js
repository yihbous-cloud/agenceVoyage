import { query } from "./db";

// État des tâches planifiées du serveur (sauvegarde, purge, contrôle de
// santé) — affiché dans « État des services » (NF-17). Table globale.

export async function recordJob(name, status, message = null, details = null) {
  await query(
    `INSERT INTO system_jobs (name, last_run_at, last_status, last_message, details) VALUES (?, UTC_TIMESTAMP(), ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), last_message = VALUES(last_message), details = VALUES(details)`,
    [name, status, message ? String(message).slice(0, 500) : null, details ? JSON.stringify(details) : null]
  );
}

export async function listJobs() {
  return query(`SELECT name, last_run_at, last_status, last_message, details FROM system_jobs ORDER BY name`);
}
