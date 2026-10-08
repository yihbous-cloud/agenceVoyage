// Sauvegarde quotidienne chiffrée (NF-14) : base MySQL + fichiers (médias
// WhatsApp hors web, fichiers envoyés du site), conservée 30 jours, copie
// hors du serveur via rclone si BACKUP_RCLONE_REMOTE est défini.
//
//   node --env-file=.env scripts/backup.mjs            (PM2 : chaque nuit)
//
// Variables : BACKUP_ENCRYPTION_KEY (obligatoire), BACKUP_DIR
// (storage/backups), BACKUP_RETENTION_DAYS (30), BACKUP_RCLONE_REMOTE
// (ex. « b2:gf-backups »), ALERT_EMAILS (alerte en cas d'échec).
// Le dump est écrit en SQL par Node (aucun mysqldump requis).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import mysql from "mysql2";
import { backupKey, encryptStream } from "./lib/backupCrypto.mjs";
import { recordSystemJob, alert } from "./lib/ops.mjs";

const ROOT = process.cwd();
const BACKUP_DIR = path.resolve(ROOT, process.env.BACKUP_DIR || "storage/backups");
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 30;
const FILE_DIRS = [process.env.WA_MEDIA_DIR || "storage/wa-media", "public/uploads"];

function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "golden_fantastic",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // JSON gardé en texte brut (sinon mysql2 le transforme en objet).
    typeCast: (field, next) => (field.type === "JSON" ? field.string("utf8") : next()),
  });
}

async function* dumpDatabase(conn, stats) {
  const db = process.env.DB_NAME || "golden_fantastic";
  const q = (sql, params) => conn.promise().query(sql, params).then(([rows]) => rows);
  yield `-- Sauvegarde ${db} — ${new Date().toISOString()}\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\n\n`;
  const tables = await q(`SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`, [db]);
  for (const { name } of tables.filter((t) => t.type === "BASE TABLE")) {
    const [create] = await q(`SHOW CREATE TABLE \`${name}\``);
    yield `DROP TABLE IF EXISTS \`${name}\`;\n${create["Create Table"]};\n`;
    let batch = [];
    let count = 0;
    for await (const row of conn.query(`SELECT * FROM \`${name}\``).stream()) {
      batch.push(`(${Object.values(row).map((v) => mysql.escape(v)).join(",")})`);
      count += 1;
      if (batch.length >= 200) {
        yield `INSERT INTO \`${name}\` VALUES ${batch.join(",\n")};\n`;
        batch = [];
      }
    }
    if (batch.length) yield `INSERT INTO \`${name}\` VALUES ${batch.join(",\n")};\n`;
    stats.tables[name] = count;
    yield "\n";
  }
  for (const { name } of tables.filter((t) => t.type === "VIEW")) {
    const [create] = await q(`SHOW CREATE VIEW \`${name}\``);
    // DEFINER retiré : la vue est recréée avec l'utilisateur de restauration.
    const sql = create["Create View"].replace(/DEFINER=`[^`]+`@`[^`]+`\s*/, "").replace(/SQL SECURITY DEFINER\s*/, "");
    yield `DROP VIEW IF EXISTS \`${name}\`;\n${sql};\n`;
    stats.views.push(name);
  }
  yield `SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n`;
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} : code ${code} ${err.slice(0, 300)}`))));
    if (opts.pipeTo) child.stdout.pipe(opts.pipeTo);
  });
}

async function backupFiles(key, target) {
  const dirs = FILE_DIRS.filter((d) => fs.existsSync(path.resolve(ROOT, d)));
  if (!dirs.length) return null;
  const out = new PassThrough();
  const done = pipeline(out, encryptStream(key), fs.createWriteStream(target));
  const tar = spawn("tar", ["-czf", "-", ...dirs], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  tar.stderr.on("data", (d) => (err += d));
  tar.stdout.pipe(out);
  await new Promise((resolve, reject) => {
    tar.on("error", reject);
    tar.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tar : code ${code} ${err.slice(0, 300)}`))));
  });
  await done;
  return dirs;
}

function prune() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const limit = Date.now() - RETENTION_DAYS * 86400 * 1000;
  const removed = [];
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    const dir = path.join(BACKUP_DIR, name);
    if (!/^\d{8}-\d{6}$/.test(name) || !fs.statSync(dir).isDirectory()) continue;
    if (fs.statSync(dir).mtimeMs < limit) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(name);
    }
  }
  return removed;
}

async function main() {
  const started = Date.now();
  const key = backupKey();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const dir = path.join(BACKUP_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });
  await recordSystemJob("sauvegarde", "en_cours", `Sauvegarde ${stamp} en cours`);

  const stats = { tables: {}, views: [] };
  const conn = connect();
  const dbFile = path.join(dir, "database.sql.gz.enc");
  try {
    await pipeline(Readable.from(dumpDatabase(conn, stats)), zlib.createGzip({ level: 6 }), encryptStream(key), fs.createWriteStream(dbFile));
  } finally {
    conn.end();
  }
  const filesFile = path.join(dir, "files.tar.gz.enc");
  const fileDirs = await backupFiles(key, filesFile);

  const manifest = {
    createdAt: new Date().toISOString(),
    database: process.env.DB_NAME || "golden_fantastic",
    tables: stats.tables,
    views: stats.views,
    fileDirs,
    files: {},
    format: "GFBK1 (AES-256-GCM) ; database : SQL gzip ; files : tar.gz",
  };
  for (const f of [dbFile, fileDirs ? filesFile : null].filter(Boolean)) {
    manifest.files[path.basename(f)] = { bytes: fs.statSync(f).size, sha256: await sha256(f) };
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  let offsite = "non configurée (BACKUP_RCLONE_REMOTE)";
  if (process.env.BACKUP_RCLONE_REMOTE) {
    const remote = process.env.BACKUP_RCLONE_REMOTE.replace(/\/+$/, "");
    await run("rclone", ["copy", dir, `${remote}/${stamp}`]);
    await run("rclone", ["delete", remote, "--min-age", `${RETENTION_DAYS}d`]).catch(() => {});
    offsite = `copiée vers ${remote}/${stamp}`;
  }
  const removed = prune();
  const totalBytes = Object.values(manifest.files).reduce((s, f) => s + f.bytes, 0);
  const message = `${stamp} : ${Object.keys(stats.tables).length} tables, ${(totalBytes / 1048576).toFixed(1)} Mo, copie hors serveur ${offsite}, ${removed.length} ancienne(s) supprimée(s), ${Math.round((Date.now() - started) / 1000)} s`;
  await recordSystemJob("sauvegarde", "ok", message, { stamp, dir, offsite: Boolean(process.env.BACKUP_RCLONE_REMOTE), bytes: totalBytes });
  console.log(`Sauvegarde terminée — ${message}`);
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(`Sauvegarde en ÉCHEC : ${err.message}`);
    await recordSystemJob("sauvegarde", "erreur", err.message).catch(() => {});
    await alert("Sauvegarde en échec", `La sauvegarde de cette nuit a échoué : ${err.message}`).catch(() => {});
    process.exit(1);
  });
