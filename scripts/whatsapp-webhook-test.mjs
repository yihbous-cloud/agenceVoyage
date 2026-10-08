// Recette automatisée du Lot 0 WhatsApp (CLAUDE.md §3centquadragies).
// Chaîne complète SANS compte Meta réel : un faux serveur Graph API local
// remplace Meta, et le script lance son propre worker pointé dessus.
//   1. serveur Next.js démarré (npm run dev, port 3000 — ou WA_TEST_BASE_URL)
//   2. Redis démarré (REDIS_URL)
//   3. npm run test:whatsapp
// Crée une agence TEMPORAIRE + son compte WhatsApp, envoie de vrais webhooks
// signés, vérifie la base, puis supprime tout.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setScriptAgencyId } from "../lib/agencyContext.js";
import { saveAccount, getAccountForAgency, getAccountCredentials } from "../lib/whatsapp/accounts.js";
import { listStaleInboundMessages, mediaRoot } from "../lib/whatsapp/processing.js";
import { listRecentMessages } from "../lib/whatsapp/messages.js";
import { signMetaPayload } from "../lib/whatsapp/signature.js";
import { getPool } from "../lib/db.js";

const BASE_URL = process.env.WA_TEST_BASE_URL || "http://localhost:3000";
const MOCK_PORT = 4010;
const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(300);
  }
  return null;
}

// --- Faux serveur Graph API -------------------------------------------------
const sent = [];
const readReceipts = [];
const MEDIA_BYTES = Buffer.from("%PDF-1.4 faux document de test\n");
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.headers.authorization !== "Bearer test-access-token") return json(401, { error: { message: "jeton invalide", code: 190 } });
    if (req.method === "POST" && /\/messages$/.test(req.url)) {
      const data = JSON.parse(body || "{}");
      if (data.status === "read") {
        readReceipts.push(data.message_id);
        return json(200, { success: true });
      }
      sent.push(data);
      return json(200, { messages: [{ id: `wamid.mock.${sent.length}.${Date.now()}` }] });
    }
    if (req.method === "GET" && req.url.startsWith("/media-file/")) {
      res.writeHead(200, { "Content-Type": "application/pdf" });
      return res.end(MEDIA_BYTES);
    }
    if (req.method === "GET" && /\/media-[a-z0-9]+$/.test(req.url)) {
      return json(200, { url: `http://127.0.0.1:${MOCK_PORT}/media-file/1`, mime_type: "application/pdf" });
    }
    return json(404, { error: { message: "inconnu" } });
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

// --- Agence temporaire + compte WhatsApp -----------------------------------
const SUBDOMAIN = `wa-test-${Date.now() % 100000}`;
const AGENCY = (await q("INSERT INTO agencies (name, subdomain) VALUES (?, ?)", ["Agence WhatsApp test", SUBDOMAIN])).insertId;
const PHONE_NUMBER_ID = String(900000000000 + Math.floor(Math.random() * 99999999));
const APP_SECRET = crypto.randomBytes(16).toString("hex");
setScriptAgencyId(AGENCY);
const account = await saveAccount({
  phoneNumberId: PHONE_NUMBER_ID,
  status: "test",
  accessToken: "test-access-token",
  appSecret: APP_SECRET,
  displayPhone: "+212 600 000 000",
});

let worker;
let workerLog = "";
async function cleanup() {
  if (worker) worker.kill("SIGINT");
  const mediaRows = await q("SELECT storage_path FROM wa_media WHERE agency_id = ? AND storage_path IS NOT NULL", [AGENCY]);
  for (const m of mediaRows) fs.rmSync(path.join(mediaRoot(), m.storage_path), { force: true });
  fs.rmSync(path.join(mediaRoot(), String(AGENCY)), { recursive: true, force: true });
  const tables = (await q("SELECT table_name n FROM information_schema.columns WHERE table_schema=DATABASE() AND column_name='agency_id'")).map((r) => r.n);
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tables) await conn.query(`DELETE FROM ${t} WHERE agency_id = ?`, [AGENCY]);
    await conn.query("DELETE FROM agencies WHERE id = ?", [AGENCY]);
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    conn.release();
  }
  mock.close();
  await pool.end();
}

try {
  // Secrets chiffrés en base, déchiffrables, jamais exposés en clair.
  const [raw] = await q("SELECT access_token_enc, app_secret_enc, verify_token FROM wa_accounts WHERE id = ?", [account.id]);
  ok(raw.access_token_enc.startsWith("v1:") && !raw.access_token_enc.includes("test-access-token"), "jeton chiffré en base (AES-GCM)");
  ok((await getAccountCredentials(AGENCY)).appSecret === APP_SECRET, "app secret déchiffré côté serveur");
  ok(!JSON.stringify(account).includes(APP_SECRET) && !JSON.stringify(account).includes("test-access-token"), "vue publique sans secret");

  // Isolation : l'agence 1 ne voit pas ce compte.
  setScriptAgencyId(1);
  const agency1Account = await getAccountForAgency();
  ok(!agency1Account || agency1Account.id !== account.id, "agence 1 ne voit pas le compte de l'agence test");
  setScriptAgencyId(AGENCY);

  // Abonnement du webhook (GET).
  const verifyOk = await fetch(`${BASE_URL}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${raw.verify_token}&hub.challenge=12345`);
  ok(verifyOk.status === 200 && (await verifyOk.text()) === "12345", "GET abonnement : bon jeton → challenge renvoyé");
  const verifyBad = await fetch(`${BASE_URL}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=mauvais&hub.challenge=1`);
  ok(verifyBad.status === 403, "GET abonnement : mauvais jeton → 403");

  // Lancement du worker pointé sur le faux Meta.
  worker = spawn(process.execPath, ["--env-file=.env", "--import", "./scripts/esm-register.mjs", "worker/index.mjs"], {
    env: { ...process.env, META_GRAPH_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, WA_ECHO_TEST: "1", WA_WORKER_AGENCY_IDS: String(AGENCY) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (d) => (workerLog += d));
  worker.stderr.on("data", (d) => (workerLog += d));

  const waId = "212600000001";
  const ts = Math.floor(Date.now() / 1000);
  const payloadOf = (messages, statuses) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "212600000000", phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Client Test" }, wa_id: waId }],
              ...(messages ? { messages } : {}),
              ...(statuses ? { statuses } : {}),
            },
          },
        ],
      },
    ],
  });
  const post = (payload, { secret = APP_SECRET, extraHeaders = {} } = {}) => {
    const body = JSON.stringify(payload);
    return fetch(`${BASE_URL}/api/webhooks/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signMetaPayload(body, secret), ...extraHeaders },
      body,
    });
  };

  const textId = `wamid.test.text.${ts}`;
  const docId = `wamid.test.doc.${ts}`;
  const textPayload = payloadOf([
    { from: waId, id: textId, timestamp: String(ts), type: "text", text: { body: "Salam, bghit nsowl 3la Omra" } },
    { from: waId, id: docId, timestamp: String(ts), type: "document", document: { id: "media-abc123", mime_type: "application/pdf", filename: "passeport.pdf", caption: "Mon passeport" } },
  ]);

  const t0 = Date.now();
  const r1 = await post(textPayload, { extraHeaders: { "x-agency-id": "1" } });
  const elapsed = Date.now() - t0;
  ok(r1.status === 200, `POST signé → 200 (${elapsed} ms)`);

  const rows = await q("SELECT id, type, content, agency_id FROM wa_messages WHERE meta_message_id IN (?, ?)", [textId, docId]);
  ok(rows.length === 2 && rows.every((r) => r.agency_id === AGENCY), "2 messages enregistrés dans la bonne agence (x-agency-id usurpé ignoré)");
  const [contact] = await q("SELECT * FROM wa_contacts WHERE agency_id = ? AND phone = ?", [AGENCY, waId]);
  ok(contact?.profile_name === "Client Test" && contact.stage === "prospect", "contact créé (nom de profil, étape prospect)");
  const convs = await q("SELECT * FROM wa_conversations WHERE agency_id = ?", [AGENCY]);
  ok(convs.length === 1 && convs[0].status === "ia" && convs[0].last_inbound_at, "une conversation ouverte, statut IA, fenêtre 24h datée");

  // Dédoublonnage : même webhook renvoyé.
  const t1 = Date.now();
  const r2 = await post(textPayload);
  const warm = Date.now() - t1;
  ok(warm < 2000, `réponse au webhook en moins de 2 s, serveur chaud (${warm} ms, WA-02)`);
  const count = (await q("SELECT COUNT(*) c FROM wa_messages WHERE agency_id = ? AND direction = 'entrant'", [AGENCY]))[0].c;
  ok(r2.status === 200 && Number(count) === 2, "webhook renvoyé → aucun doublon (WA-04)");

  // Signature invalide / absente.
  const r3 = await post(payloadOf([{ from: waId, id: `wamid.bad.${ts}`, timestamp: String(ts), type: "text", text: { body: "x" } }]), { secret: "mauvais-secret" });
  ok(r3.status === 401, "signature invalide → 401");
  const r4 = await fetch(`${BASE_URL}/api/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(textPayload) });
  ok(r4.status === 401, "signature absente → 401");
  ok((await q("SELECT COUNT(*) c FROM wa_messages WHERE meta_message_id = ?", [`wamid.bad.${ts}`]))[0].c == 0, "rien n'est enregistré sans signature valide");

  // Numéro inconnu : ignoré (200), rien d'enregistré.
  const unknown = payloadOf([{ from: waId, id: `wamid.unknown.${ts}`, timestamp: String(ts), type: "text", text: { body: "x" } }]);
  unknown.entry[0].changes[0].value.metadata.phone_number_id = "111";
  const r5 = await post(unknown);
  ok(r5.status === 200 && (await q("SELECT COUNT(*) c FROM wa_messages WHERE meta_message_id = ?", [`wamid.unknown.${ts}`]))[0].c == 0, "numéro inconnu → ignoré");

  // Worker : traitement, média stocké hors public/, accusé de lecture, écho.
  const processed = await waitFor(async () => {
    const r = await q("SELECT processing_status FROM wa_messages WHERE meta_message_id IN (?, ?)", [textId, docId]);
    return r.length === 2 && r.every((x) => x.processing_status === "traite") ? r : null;
  });
  ok(Boolean(processed), "worker : les 2 messages passent à « traité »");
  const [media] = await q("SELECT * FROM wa_media WHERE agency_id = ?", [AGENCY]);
  const mediaPath = media?.storage_path ? path.join(mediaRoot(), media.storage_path) : null;
  ok(mediaPath && fs.existsSync(mediaPath) && fs.readFileSync(mediaPath).equals(MEDIA_BYTES), "média téléchargé et stocké (WA-07)");
  ok(mediaPath && !path.resolve(mediaPath).includes(`${path.sep}public${path.sep}`), "média stocké hors de public/ (NF-09)");
  ok(readReceipts.includes(textId), "accusé de lecture envoyé à Meta");
  const echo = await waitFor(async () => sent.find((m) => m.text?.body === "Écho : Salam, bghit nsowl 3la Omra"));
  ok(Boolean(echo) && echo.to === waId && echo.context?.message_id === textId, "écho de test renvoyé au client (réponse au message)");
  const outbound = await waitFor(async () => (await q("SELECT * FROM wa_messages WHERE agency_id = ? AND direction = 'sortant'", [AGENCY]))[0]);
  ok(outbound?.status === "envoye" && outbound.meta_message_id?.startsWith("wamid.mock"), "message sortant enregistré (statut envoyé, id Meta)");

  // Statuts de livraison : lu puis livré (désordre) → reste « lu ».
  await post(payloadOf(null, [{ id: outbound.meta_message_id, status: "read", timestamp: String(ts + 2), recipient_id: waId }]));
  await post(payloadOf(null, [{ id: outbound.meta_message_id, status: "delivered", timestamp: String(ts + 1), recipient_id: waId, pricing: { category: "service", billable: false } }]));
  const [afterStatus] = await q("SELECT status FROM wa_messages WHERE id = ?", [outbound.id]);
  ok(afterStatus.status === "lu", "statut « lu » non écrasé par un « livré » arrivé en retard (WA-08)");

  // Balayage : un message resté « recu » (Redis indisponible) est repris.
  const [conv] = convs;
  const stuck = await q(
    `INSERT INTO wa_messages (agency_id, conversation_id, meta_message_id, direction, author, type, content, processing_status, created_at)
     VALUES (?, ?, ?, 'entrant', 'client', 'text', 'message bloqué', 'recu', UTC_TIMESTAMP() - INTERVAL 1 MINUTE)`,
    [AGENCY, conv.id, `wamid.stuck.${ts}`]
  );
  ok((await listStaleInboundMessages()).some((r) => r.id === stuck.insertId), "message non signalé détecté par le balayage");
  const swept = await waitFor(async () => (await q("SELECT processing_status FROM wa_messages WHERE id = ?", [stuck.insertId]))[0].processing_status === "traite", 45000);
  ok(Boolean(swept), "balayage du worker : message bloqué traité (NF-04, aucun message perdu)");

  // Journal admin : uniquement les messages de l'agence.
  ok((await listRecentMessages(AGENCY)).length >= 4 && (await listRecentMessages(1)).every((m) => m.phone !== waId), "journal des messages isolé par agence");

} catch (err) {
  failures += 1;
  console.error("ERREUR", err);
} finally {
  if (failures) console.log("\n--- journal du worker ---\n" + workerLog);
  await cleanup();
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrôles passent.");
process.exit(failures ? 1 : 0);
