// Contrôle de santé du serveur (NF-05, NF-17), lancé toutes les 5 minutes
// par PM2 (ecosystem.config.cjs) :
//   node --env-file=.env scripts/healthcheck.mjs
// Vérifie base, Redis, worker (battement de cœur), file des messages reçus,
// webhooks Meta, sauvegarde de la nuit, espace disque. Résultat dans
// system_jobs (« État des services ») ; alerte e-mail au passage en échec,
// puis toutes les 6 h tant que le problème persiste, et au rétablissement.
import fs from "node:fs";
import mysql from "mysql2/promise";
import IORedis from "ioredis";
import { dbConfig, recordSystemJob, alert } from "./lib/ops.mjs";

const HEARTBEAT_KEY = "gf:worker:heartbeat";
const REALERT_HOURS = 6;

async function checkRedis() {
  const redis = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
  redis.on("error", () => {});
  try {
    await redis.connect();
    await redis.ping();
    const beat = await redis.get(HEARTBEAT_KEY);
    return { redis: true, workerAge: beat ? Math.round((Date.now() - Number(beat)) / 1000) : null };
  } catch (err) {
    return { redis: false, error: err.message };
  } finally {
    redis.disconnect();
  }
}

async function main() {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  let conn = null;
  try {
    conn = await mysql.createConnection(dbConfig());
    await conn.query("SELECT 1");
    add("Base MySQL", true, "joignable");
  } catch (err) {
    add("Base MySQL", false, err.message);
  }

  const r = await checkRedis();
  add("Redis (files d'attente)", r.redis, r.redis ? "joignable" : r.error);
  if (r.redis) add("Worker WhatsApp", r.workerAge != null && r.workerAge < 120, r.workerAge == null ? "aucun battement de cœur" : `dernier signe de vie il y a ${r.workerAge} s`);

  if (conn) {
    const [[stuck]] = await conn.query(
      `SELECT COUNT(*) AS n FROM wa_messages -- agency-lint-ok: contrôle technique global
       WHERE direction = 'entrant' AND processing_status = 'recu' AND created_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE`
    );
    add("Messages reçus en attente de traitement", Number(stuck.n) === 0, `${stuck.n} message(s) non traité(s) depuis plus de 5 min`);
    const [accounts] = await conn.query(
      `SELECT a.agency_id, ag.name, a.last_webhook_at, TIMESTAMPDIFF(HOUR, a.last_webhook_at, UTC_TIMESTAMP()) AS hours
       FROM wa_accounts a JOIN agencies ag ON ag.id = a.agency_id -- agency-lint-ok: contrôle technique global
       WHERE a.status = 'actif'`
    );
    for (const a of accounts) {
      add(`Webhook Meta (${a.name})`, a.hours != null && Number(a.hours) < 24, a.last_webhook_at ? `dernier appel il y a ${a.hours} h` : "aucun appel reçu");
    }
    const [[backup]] = await conn.query(
      `SELECT last_status, last_run_at, TIMESTAMPDIFF(HOUR, last_run_at, UTC_TIMESTAMP()) AS hours FROM system_jobs WHERE name = 'sauvegarde'`
    );
    if (backup) add("Sauvegarde de la nuit", backup.last_status === "ok" && Number(backup.hours) < 26, `${backup.last_status}, il y a ${backup.hours} h`);
    else add("Sauvegarde de la nuit", false, "aucune sauvegarde enregistrée");
  }

  try {
    const st = fs.statfsSync(process.cwd());
    const free = st.bavail * st.bsize;
    const ratio = free / (st.blocks * st.bsize);
    add("Espace disque", ratio > 0.1 && free > 2 * 1024 ** 3, `${(free / 1024 ** 3).toFixed(1)} Go libres (${Math.round(ratio * 100)} %)`);
  } catch (err) {
    add("Espace disque", true, `non mesurable (${err.message})`);
  }

  const failed = checks.filter((c) => !c.ok);
  const status = failed.length ? "erreur" : "ok";
  const message = failed.length ? failed.map((c) => `${c.name} : ${c.detail}`).join(" ; ") : `${checks.length} contrôles OK`;

  // Alerte : passage en échec, rappel toutes les 6 h, retour à la normale.
  let previous = null;
  if (conn) {
    const [[row]] = await conn.query(`SELECT last_status, details FROM system_jobs WHERE name = 'sante'`);
    previous = row || null;
    await conn.end();
  }
  const prevDetails = previous?.details ? (typeof previous.details === "string" ? JSON.parse(previous.details) : previous.details) : {};
  let lastAlertAt = prevDetails.lastAlertAt || null;
  const hoursSinceAlert = lastAlertAt ? (Date.now() - Date.parse(lastAlertAt)) / 3600000 : Infinity;
  if (status === "erreur" && (previous?.last_status !== "erreur" || hoursSinceAlert >= REALERT_HOURS)) {
    await alert("Problème détecté sur le serveur", `Contrôle de santé du ${new Date().toISOString()} :\n\n${checks.map((c) => `${c.ok ? "OK " : "ÉCHEC"} — ${c.name} : ${c.detail}`).join("\n")}`);
    lastAlertAt = new Date().toISOString();
  } else if (status === "ok" && previous?.last_status === "erreur") {
    await alert("Retour à la normale", "Tous les contrôles de santé sont de nouveau au vert.");
    lastAlertAt = null;
  }
  await recordSystemJob("sante", status, message, { checks, lastAlertAt }).catch((err) => console.error(`Enregistrement impossible : ${err.message}`));
  console.log(`[sante] ${status.toUpperCase()} — ${message}`);
  process.exit(status === "ok" ? 0 : 1);
}

main().catch(async (err) => {
  console.error(`Contrôle de santé impossible : ${err.message}`);
  await alert("Contrôle de santé impossible", err.message).catch(() => {});
  process.exit(1);
});
