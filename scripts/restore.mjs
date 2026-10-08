// Restauration d'une sauvegarde (NF-14, guide d'exploitation).
//
//   Vérification (test trimestriel, sans toucher à la base de production) :
//     node --env-file=.env scripts/restore.mjs storage/backups/20261008-023000 --verify
//   Restauration réelle dans une base donnée (serveur de test ou reprise) :
//     node --env-file=.env scripts/restore.mjs <dossier> --database golden_fantastic_test [--files /chemin/cible]
//
// --verify : restaure dans une base temporaire, compare le nombre de lignes
// de chaque table au manifeste, contrôle l'archive des fichiers, puis
// supprime la base temporaire. Restaurer dans la base de production
// (DB_NAME) exige --force.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import mysql from "mysql2/promise";
import { backupKey, decryptStream } from "./lib/backupCrypto.mjs";
import { dbConfig, recordSystemJob, alert } from "./lib/ops.mjs";

const args = process.argv.slice(2);
const VALUE_OPTIONS = new Set(["--database", "--files"]);
const dir = args.find((a, i) => !a.startsWith("--") && !VALUE_OPTIONS.has(args[i - 1]));
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const verify = args.includes("--verify");
let cleanup = null; // suppression de la base temporaire du mode --verify
const force = args.includes("--force");

function usage(msg) {
  console.error(`${msg}\nUsage : node --env-file=.env scripts/restore.mjs <dossier de sauvegarde> (--verify | --database <base> [--files <dossier>] [--force])`);
  process.exit(2);
}

async function restoreDatabase(key, file, database) {
  const admin = await mysql.createConnection(dbConfig({ database: undefined }));
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  const conn = await mysql.createConnection(dbConfig({ database }));
  let buffer = "";
  let statements = 0;
  const sink = new Writable({
    decodeStrings: false,
    async write(chunk, _enc, cb) {
      try {
        buffer += chunk.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf(";\n")) !== -1) {
          const stmt = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          // Lignes de commentaire (« -- ») retirées ; le reste est une instruction.
          const sql = stmt.split("\n").filter((l) => !l.startsWith("-- ")).join("\n").trim();
          if (sql) {
            await conn.query(sql);
            statements += 1;
          }
        }
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });
  try {
    await pipeline(fs.createReadStream(file), decryptStream(key), zlib.createGunzip(), sink);
    if (buffer.trim()) await conn.query(buffer);
  } finally {
    await conn.end();
  }
  return statements;
}

// AES-GCM n'authentifie le contenu qu'à la fin du flux : on vérifie donc
// l'intégrité de chaque fichier AVANT d'écrire quoi que ce soit en base.
async function verifyIntegrity(key, file) {
  await pipeline(fs.createReadStream(file), decryptStream(key), new Writable({ write: (_c, _e, cb) => cb() }));
}

async function dropDatabase(database) {
  const admin = await mysql.createConnection(dbConfig({ database: undefined }));
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await admin.end();
}

async function countRows(database, tables) {
  const conn = await mysql.createConnection(dbConfig({ database }));
  const out = {};
  try {
    for (const t of tables) {
      const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      out[t] = Number(r.n);
    }
  } finally {
    await conn.end();
  }
  return out;
}

function extractFiles(key, file, target, listOnly) {
  return new Promise((resolve, reject) => {
    if (!listOnly) fs.mkdirSync(target, { recursive: true });
    const tar = spawn("tar", listOnly ? ["-tzf", "-"] : ["-xzf", "-", "-C", target], { stdio: ["pipe", "pipe", "pipe"] });
    let entries = 0;
    let err = "";
    tar.stdout.on("data", (d) => (entries += String(d).split("\n").filter(Boolean).length));
    tar.stderr.on("data", (d) => (err += d));
    tar.on("error", reject);
    tar.on("close", (code) => (code === 0 ? resolve(entries) : reject(new Error(`tar : code ${code} ${err.slice(0, 300)}`))));
    pipeline(fs.createReadStream(file), decryptStream(key), tar.stdin).catch(reject);
  });
}

async function main() {
  if (!dir) usage("Dossier de sauvegarde manquant.");
  const base = path.resolve(dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8"));
  const key = backupKey();
  const target = verify ? `${process.env.DB_NAME || "golden_fantastic"}_restore_test_${Date.now()}` : opt("--database");
  if (!target) usage("Préciser --verify ou --database <base>.");
  if (!verify && target === (process.env.DB_NAME || "golden_fantastic") && !force) {
    usage(`Refus : « ${target} » est la base de production. Ajouter --force pour l'écraser (après avoir vérifié la sauvegarde avec --verify).`);
  }

  const started = Date.now();
  for (const name of Object.keys(manifest.files)) await verifyIntegrity(key, path.join(base, name));
  console.log("  Intégrité des fichiers vérifiée (chiffrement authentifié).");
  if (verify) cleanup = () => dropDatabase(target);
  console.log(`Restauration de ${path.basename(base)} (${manifest.createdAt}) dans la base « ${target} »...`);
  const statements = await restoreDatabase(key, path.join(base, "database.sql.gz.enc"), target);
  console.log(`  ${statements} instructions SQL exécutées.`);

  const counts = await countRows(target, Object.keys(manifest.tables));
  const mismatches = Object.entries(manifest.tables).filter(([t, n]) => counts[t] !== n);
  let filesInfo = "aucune archive de fichiers";
  if (manifest.files["files.tar.gz.enc"]) {
    const archive = path.join(base, "files.tar.gz.enc");
    const filesTarget = opt("--files");
    const entries = await extractFiles(key, archive, filesTarget, verify || !filesTarget);
    filesInfo = verify || !filesTarget ? `archive lisible (${entries} entrées)` : `${entries} fichiers extraits dans ${filesTarget}`;
  }

  if (verify) {
    await dropDatabase(target);
    cleanup = null;
  }
  const ok = mismatches.length === 0;
  const message = `${path.basename(base)} : ${Object.keys(counts).length} tables ${ok ? "identiques au manifeste" : `— ${mismatches.length} écart(s) : ${mismatches.map(([t, n]) => `${t} ${counts[t]}/${n}`).join(", ")}`}, ${filesInfo}, ${Math.round((Date.now() - started) / 1000)} s`;
  if (verify) await recordSystemJob("test_restauration", ok ? "ok" : "erreur", message);
  console.log(`${ok ? "RESTAURATION OK" : "RESTAURATION INCOMPLÈTE"} — ${message}`);
  if (!ok) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(`Restauration en ÉCHEC : ${err.message}`);
  if (cleanup) await cleanup().catch(() => {});
  if (verify) {
    await recordSystemJob("test_restauration", "erreur", err.message).catch(() => {});
    await alert("Test de restauration en échec", err.message).catch(() => {});
  }
  process.exit(1);
});
