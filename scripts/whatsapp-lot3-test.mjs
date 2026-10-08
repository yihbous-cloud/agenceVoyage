// Recette automatisée du Lot 3 WhatsApp : campagnes (CP-01→06), coûts,
// tableau de bord / statistiques / rapport quotidien, contacts (import,
// export), données personnelles (export, suppression, purge), audit IA
// hebdomadaire, double authentification et verrouillage, limitation de
// débit, sauvegarde chiffrée + restauration vérifiée.
// Sans aucun appel réel : faux serveur Meta (4020, avec latence pour simuler
// un envoi de masse), e-mails écrits dans storage/mail-outbox.jsonl, worker
// lancé par le script et limité à l'agence TEMPORAIRE, supprimée à la fin.
//   Prérequis : npm run dev (port 3000 ou WA_TEST_BASE_URL) + Redis.
//   npm run test:whatsapp-lot3
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const BASE_URL = process.env.WA_TEST_BASE_URL || "http://localhost:3000";
process.env.META_GRAPH_BASE_URL = "http://127.0.0.1:4020";
process.env.MAIL_TRANSPORT = "json";
const MEDIA_DIR = path.resolve(process.env.WA_MEDIA_DIR || "storage/wa-media");
const OUTBOX = path.resolve("storage/mail-outbox.jsonl");

const { setScriptAgencyId, runWithAgency } = await import("../lib/agencyContext.js");
const { saveAccount } = await import("../lib/whatsapp/accounts.js");
const tpl = await import("../lib/whatsapp/templates.js");
const cp = await import("../lib/whatsapp/campaigns.js");
const ops = await import("../lib/whatsapp/ops.js");
const analytics = await import("../lib/whatsapp/analytics.js");
const { deliverDailyReport } = await import("../lib/whatsapp/reports.js");
const contacts = await import("../lib/whatsapp/contacts.js");
const privacy = await import("../lib/whatsapp/privacy.js");
const journal = await import("../lib/whatsapp/journal.js");
const { totpCode, verifyTotp, base32Encode } = await import("../lib/totp.js");
const { hashPassword } = await import("../lib/auth.js");
const { createRegistration } = await import("../lib/registrations.js");
const { signMetaPayload } = await import("../lib/whatsapp/signature.js");
const { getPool } = await import("../lib/db.js");

const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 30000, every = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}
async function expectError(fn, code) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e.code === code;
  }
}

// --- Faux serveur Meta (latence 60 ms par envoi de template) ---------------------
const meta = { sent: [] };
const metaServer = await new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const data = body ? JSON.parse(body) : {};
      const reply = (obj) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.method === "POST" && /\/messages$/.test(req.url)) {
        if (data.status === "read") return reply({ success: true });
        meta.sent.push({ ...data, at: Date.now() });
        const id = `wamid.l3.${meta.sent.length}.${Date.now()}`;
        return data.type === "template" ? setTimeout(() => reply({ messages: [{ id }] }), 60) : reply({ messages: [{ id }] });
      }
      return reply({});
    });
  });
  server.listen(4020, "127.0.0.1", () => resolve(server));
});

// --- Agence temporaire ------------------------------------------------------------
const SUB = `wa-lot3-${Date.now() % 100000}`;
const AGENCY = (await q("INSERT INTO agencies (name, subdomain, phone, address, city) VALUES (?, ?, ?, ?, ?)", ["Agence Lot3", SUB, "0522000000", "1 rue Test", "Casablanca"])).insertId;
const roleIds = {};
for (const name of ["direction", "ventes", "comptabilite", "suivi"]) {
  roleIds[name] = (await q("INSERT INTO roles (name, description, agency_id) VALUES (?, ?, ?)", [name, name, AGENCY])).insertId;
}
await q("INSERT INTO role_permissions (role_id, permission_code) VALUES (?, 'whatsapp.dashboard')", [roleIds.ventes]);
const PHONE_NUMBER_ID = String(930000000000 + Math.floor(Math.random() * 99999999));
const APP_SECRET = crypto.randomBytes(16).toString("hex");
setScriptAgencyId(AGENCY);
await saveAccount({ phoneNumberId: PHONE_NUMBER_ID, wabaId: "WABA_L3", displayPhone: "+212 600 333 444", status: "actif", accessToken: "tok", appSecret: APP_SECRET });
const program = (await q("INSERT INTO programs (title, slug, family, agency_id, is_published) VALUES ('Omra Test Lot3', ?, 'omra_hajj', ?, TRUE)", [`omra-lot3-${AGENCY}`, AGENCY])).insertId;
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const trip = (await q("INSERT INTO trips (program_id, reference_code, departure_date, return_date, price_double, status, agency_id) VALUES (?, ?, ?, ?, 15000, 'ouvert', ?)", [program, `L3-${AGENCY}`, inDays(30), inDays(44), AGENCY])).insertId;
const pastTrip = (await q("INSERT INTO trips (program_id, reference_code, departure_date, return_date, price_double, status, agency_id) VALUES (?, ?, ?, ?, 15000, 'termine', ?)", [program, `L3P-${AGENCY}`, inDays(-80), inDays(-60), AGENCY])).insertId;

// Contacts : 3 consentants « nommés », 1 sans consentement, 1 bloqué, 60 consentants de masse.
const phone = (n) => `21260${String(7000000 + n).padStart(7, "0")}`;
async function addContact(n, { optIn = true, blocked = false, stage = "prospect", name = `Client ${n}`, qualification = null } = {}) {
  return (await q("INSERT INTO wa_contacts (agency_id, phone, profile_name, language, stage, marketing_opt_in, blocked, qualification, source) VALUES (?, ?, ?, 'fr', ?, ?, ?, ?, 'flyer')", [
    AGENCY, phone(n), name, stage, optIn, blocked, qualification ? JSON.stringify(qualification) : null,
  ])).insertId;
}
const C1 = await addContact(1, { name: "Fatima Test", stage: "qualifie", qualification: { type_voyage: "omra", ville_depart: "Casablanca" } });
const C2 = await addContact(2, { name: "Youssef Test" });
const C3 = await addContact(3, { name: "Salma Test" });
const C4 = await addContact(4, { optIn: false, name: "Sans consentement" });
const C5 = await addContact(5, { blocked: true, name: "Bloqué" });
for (let i = 10; i < 70; i += 1) await addContact(i);
const CONSENTING = 63;

let worker;
let workerLog = "";
function startWorker() {
  worker = spawn(process.execPath, ["--env-file=.env", "--import", "./scripts/esm-register.mjs", "worker/index.mjs"], {
    env: { ...process.env, WA_WORKER_AGENCY_IDS: String(AGENCY), WA_ECHO_TEST: "0", ANTHROPIC_API_KEY: "", WA_CAMPAIGN_INTERVAL_MS: "1500", WA_CAMPAIGN_IGNORE_HOURS: "1", WA_AI_DEBOUNCE_MS: "500" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (d) => (workerLog += d));
  worker.stderr.on("data", (d) => (workerLog += d));
}

let seq = 0;
function webhook(payload) {
  const body = JSON.stringify(payload);
  return fetch(`${BASE_URL}/api/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signMetaPayload(body, APP_SECRET) }, body });
}
async function inbound(waId, text) {
  seq += 1;
  const ts = Math.floor(Date.now() / 1000);
  const id = `wamid.l3.in.${seq}.${ts}.${Math.random().toString(36).slice(2, 6)}`;
  await webhook({ object: "whatsapp_business_account", entry: [{ id: "WABA_L3", changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ profile: { name: "Client" }, wa_id: waId }], messages: [{ from: waId, id, timestamp: String(ts), type: "text", text: { body: text } }] } }] }] });
  return id;
}
function statusWebhook(metaId, pricing) {
  return webhook({ object: "whatsapp_business_account", entry: [{ id: "WABA_L3", changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id: metaId, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: "x", pricing }] } }] }] });
}

// Requête HTTP vers le sous-domaine de l'agence de test (Node ne résout pas *.localhost).
function call(method, pathname, { body = null, cookie = null } = {}) {
  const url = new URL(BASE_URL);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: url.hostname, port: url.port, path: pathname, method, headers: { host: `${SUB}.localhost:${url.port}`, ...(payload ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          const set = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("gf_session="));
          resolve({ status: res.statusCode, json, cookie: set || null });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const outboxExisted = fs.existsSync(OUTBOX);
const outboxStart = outboxExisted ? fs.statSync(OUTBOX).size : 0;
const createdFiles = [];
let backupDir = null;

async function cleanup() {
  if (worker) worker.kill("SIGINT");
  const tables = (await q("SELECT DISTINCT c.table_name n FROM information_schema.columns c JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE c.table_schema = DATABASE() AND c.column_name = 'agency_id' AND t.table_type = 'BASE TABLE'")).map((r) => r.n);
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tables) await conn.query(`DELETE FROM \`${t}\` WHERE agency_id = ?`, [AGENCY]);
    await conn.query("DELETE FROM role_permissions WHERE role_id IN (?)", [Object.values(roleIds)]);
    await conn.query("DELETE FROM agencies WHERE id = ?", [AGENCY]);
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    conn.release();
  }
  for (const f of createdFiles) fs.rmSync(f, { force: true });
  fs.rmSync(path.join(MEDIA_DIR, `l3-${AGENCY}`), { recursive: true, force: true });
  if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });
  if (!outboxExisted) fs.rmSync(OUTBOX, { force: true });
  metaServer.close();
}

try {
  // === Réglages d'exploitation ===
  const opsDefault = await ops.getOpsSettings(AGENCY);
  ok(opsDefault.report_hour === 19 && opsDefault.purge_enabled === false && opsDefault.report_sections.length === 7, "réglages d'exploitation par défaut (rapport 19h, purge désactivée)");
  ok(await expectError(() => ops.saveOpsSettings({ price_marketing_mad: -1 }, AGENCY), "VALIDATION"), "tarif négatif refusé");
  ok(await expectError(() => ops.saveOpsSettings({ report_emails: "pas-un-email" }, AGENCY), "VALIDATION"), "adresse e-mail invalide refusée");
  await ops.saveOpsSettings({ price_marketing_mad: 1.5, report_emails: "direction@agence.test" }, AGENCY);

  // === Templates de campagne (marketing, approuvés) ===
  for (const [name, text] of [["promo_a", "Bonjour {{1}}, découvrez notre nouvelle offre Omra."], ["promo_b", "Salam {{1}} ! Places limitées pour notre Omra."]]) {
    const t = await tpl.saveTemplateDraft({ name, language: "fr", category: "MARKETING", simple: { headerType: "NONE", body: text, buttons: [] }, mapping: { "body.1": "contact.prenom" } }, AGENCY);
    await q("UPDATE wa_templates SET status = 'APPROVED', category = 'MARKETING' WHERE id = ?", [t.id]);
  }

  // === Segments (CP-01) ===
  const all = await cp.previewSegment({}, AGENCY);
  ok(all.count === CONSENTING, `segment : seuls les contacts consentants et non bloqués (${all.count}/${CONSENTING})`);
  const qualified = await cp.previewSegment({ stages: ["qualifie"], travel_types: ["omra"], city: "casa" }, AGENCY);
  ok(qualified.count === 1 && qualified.sample[0].id === C1, "segment : filtres étape + type de voyage + ville");
  await cp.saveSegment({ name: "Prospects omra", filters: { travel_types: ["omra"] } }, null, AGENCY);
  ok((await cp.listSegments(AGENCY)).length === 1, "segment enregistré");

  // === Campagne A/B : préparation, estimation, validation (CP-02→04) ===
  ok(await expectError(() => cp.saveCampaign({ name: "X", template_name: "promo_a", template_b_name: "promo_a", filters: {} }, null, AGENCY), "VALIDATION"), "A/B : deux templates différents exigés");
  const camp1 = await cp.saveCampaign({ name: "Omra Ramadan A/B", filters: {}, template_name: "promo_a", template_b_name: "promo_b", ab_test_percent: 20, ab_wait_hours: 1, batch_size: 30 }, null, AGENCY);
  let c1 = await cp.getCampaign(camp1, AGENCY);
  ok(c1.status === "brouillon" && c1.estimated_recipients === CONSENTING && Number(c1.estimated_cost) === CONSENTING * 1.5, `estimation : ${c1.estimated_recipients} destinataires × 1,5 MAD = ${c1.estimated_cost} MAD (CP-04)`);
  ok(await expectError(() => cp.approveCampaign(camp1, null, AGENCY), "CONFLICT"), "validation impossible avant soumission (CP-03)");
  await cp.submitCampaign(camp1, AGENCY);
  ok((await cp.getCampaign(camp1, AGENCY)).status === "a_valider", "campagne soumise : à valider");
  const notif = await q("SELECT title FROM staff_notifications WHERE agency_id = ? AND kind = 'campagne'", [AGENCY]);
  ok(notif.some((n) => /à valider/.test(n.title)), "responsable notifié de la campagne à valider");
  await cp.approveCampaign(camp1, null, AGENCY);
  ok((await cp.getCampaign(camp1, AGENCY)).status === "validee", "campagne validée par le responsable");

  // === Envoi progressif par le worker (file séparée) + A/B (CP-02, CP-05, NF-03) ===
  startWorker();
  const started = await waitFor(async () => (await cp.getCampaign(camp1, AGENCY)).status === "en_cours", 20000);
  ok(Boolean(started), "campagne démarrée par le worker (destinataires figés)");
  const recipients = await q("SELECT * FROM wa_campaign_recipients WHERE campaign_id = ?", [camp1]);
  const testRows = recipients.filter((r) => r.phase === "test");
  ok(recipients.length === CONSENTING && testRows.length === Math.round(CONSENTING * 0.2) && testRows.some((r) => r.variant === "B") && testRows.some((r) => r.variant === "A"), `A/B : ${testRows.length} contacts de test répartis A/B sur ${recipients.length}`);
  ok(!recipients.some((r) => [C4, C5].includes(r.contact_id)), "aucun contact sans consentement ni bloqué parmi les destinataires");

  // Consentement retiré après le lancement : contact écarté avant l'envoi.
  const victim = recipients.find((r) => r.phase === "principal");
  await q("UPDATE wa_contacts SET marketing_opt_in = FALSE WHERE id = ?", [victim.contact_id]);

  // NF-03 : un message client pendant l'envoi de masse est traité sans attendre.
  await waitFor(async () => (await q("SELECT COUNT(*) n FROM wa_campaign_recipients WHERE campaign_id = ? AND status = 'envoye'", [camp1]))[0].n >= 3, 20000, 200);
  const inId = await inbound(phone(4), "Bonjour, une question");
  const t0 = Date.now();
  const processed = await waitFor(async () => (await q("SELECT processing_status FROM wa_messages WHERE meta_message_id = ?", [inId]))[0]?.processing_status === "traite", 15000, 200);
  ok(Boolean(processed) && Date.now() - t0 < 10000, `message client traité en ${((Date.now() - t0) / 1000).toFixed(1)} s pendant l'envoi de masse (NF-03)`);

  // Fin de la phase de test, réponses des destinataires B → B gagne.
  const testDone = await waitFor(async () => (await cp.getCampaign(camp1, AGENCY)).test_sent_at, 40000);
  ok(Boolean(testDone), "phase de test A/B envoyée, attente des résultats");
  const sentTest = await q("SELECT r.contact_id, r.variant, ct.phone FROM wa_campaign_recipients r JOIN wa_contacts ct ON ct.id = r.contact_id WHERE r.campaign_id = ? AND r.phase = 'test' AND r.status = 'envoye'", [camp1]);
  for (const r of sentTest.filter((x) => x.variant === "B").slice(0, 3)) await inbound(r.phone, "Intéressé !");
  await sleep(1500);
  await q("UPDATE wa_campaigns SET test_sent_at = UTC_TIMESTAMP() - INTERVAL 2 HOUR WHERE id = ?", [camp1]);
  const winner = await waitFor(async () => (await cp.getCampaign(camp1, AGENCY)).ab_winner, 20000);
  ok(winner === "B", `variante gagnante désignée : ${winner} (taux de réponse)`);
  const finished = await waitFor(async () => (await cp.getCampaign(camp1, AGENCY)).status === "terminee", 60000, 500);
  ok(Boolean(finished), "campagne terminée après envoi progressif par lots");
  const final = await q("SELECT phase, variant, status, result FROM wa_campaign_recipients WHERE campaign_id = ?", [camp1]);
  ok(final.filter((r) => r.phase === "principal" && r.status === "envoye").every((r) => r.variant === "B"), "le reste du segment a reçu la variante B");
  const victimRow = (await q("SELECT status, result FROM wa_campaign_recipients WHERE id = ?", [victim.id]))[0];
  ok(victimRow.status === "ignore" && /consentement/.test(victimRow.result || ""), "consentement retiré après le lancement : contact écarté");
  const campaignMsgs = await q("SELECT id, meta_message_id, campaign_id FROM wa_messages WHERE agency_id = ? AND campaign_id = ?", [AGENCY, camp1]);
  ok(campaignMsgs.length === CONSENTING - 1, `${campaignMsgs.length} messages rattachés à la campagne`);
  const sentToPhones = new Set(meta.sent.filter((m) => m.type === "template").map((m) => m.to));
  ok(!sentToPhones.has(phone(4)) && !sentToPhones.has(phone(5)), "Meta : aucun template envoyé aux contacts exclus");
  const firstParams = meta.sent.find((m) => m.type === "template")?.template?.components?.[0]?.parameters?.[0]?.text;
  ok(Boolean(firstParams) && firstParams !== "{{1}}", `variables remplies depuis le CRM (prénom : ${firstParams})`);

  // Coût réel relevé dans le statut Meta (§8.3).
  await statusWebhook(campaignMsgs[0].meta_message_id, { billable: true, category: "marketing", pricing_model: "PMP" });
  await statusWebhook(campaignMsgs[1].meta_message_id, { billable: false, category: "service", pricing_model: "PMP" });
  const costed = await waitFor(async () => {
    const rows = await q("SELECT cost_mad FROM wa_messages WHERE id IN (?, ?) ORDER BY id", [campaignMsgs[0].id, campaignMsgs[1].id]);
    return rows.every((r) => r.cost_mad !== null) ? rows : null;
  }, 10000);
  ok(costed && Number(costed[0].cost_mad) === 1.5 && Number(costed[1].cost_mad) === 0, "coût Meta par message : facturé 1,5 MAD / non facturé 0");

  // Résultats (CP-06) : réponses, inscription générée, désinscription.
  const respPhone = sentTest.find((x) => x.variant === "B").phone;
  const stopRow = (await q("SELECT ct.phone, ct.id FROM wa_campaign_recipients r JOIN wa_contacts ct ON ct.id = r.contact_id WHERE r.campaign_id = ? AND r.status = 'envoye' AND r.phase = 'principal' LIMIT 1", [camp1]))[0];
  await inbound(stopRow.phone, "STOP");
  const reg = await runWithAgency(AGENCY, () => createRegistration({ tripId: trip, fullName: "Fatima Test", phoneWhatsapp: `0${respPhone.slice(3)}`, gender: "femme" }));
  const travelerId = (await q("SELECT traveler_id FROM registrations WHERE id = ?", [reg.id]))[0].traveler_id;
  await q("UPDATE wa_contacts SET traveler_id = ? WHERE agency_id = ? AND phone = ?", [travelerId, AGENCY, respPhone]);
  await waitFor(async () => (await q("SELECT COUNT(*) n FROM wa_consents WHERE contact_id = ? AND action = 'retrait'", [stopRow.id]))[0].n > 0, 15000);
  const report = await cp.campaignReport(camp1, AGENCY);
  const s = report.stats;
  ok(s.sent === CONSENTING - 1 && s.skipped === 1 && s.replies >= 3 && s.registrations === 1 && s.unsubscribed === 1, `rapport : ${s.sent} envoyés, ${s.replies} réponses, ${s.registrations} inscription, ${s.unsubscribed} désinscription`);
  ok(s.cost_per_registration != null && report.responders.length >= 3 && report.ab && report.ab.B > report.ab.A, `coût par inscription ${s.cost_per_registration} MAD, ${report.responders.length} contacts ayant répondu`);

  // === Arrêt d'urgence (CP-05) ===
  const camp3 = await cp.saveCampaign({ name: "Arrêt d'urgence", filters: {}, template_name: "promo_a", batch_size: 10 }, null, AGENCY);
  await q("UPDATE wa_contacts SET marketing_opt_in = TRUE WHERE id = ?", [victim.contact_id]);
  await cp.submitCampaign(camp3, AGENCY);
  await cp.approveCampaign(camp3, null, AGENCY);
  await waitFor(async () => (await q("SELECT COUNT(*) n FROM wa_campaign_recipients WHERE campaign_id = ? AND status = 'envoye'", [camp3]))[0].n >= 1, 20000, 200);
  await cp.stopCampaign(camp3, null, AGENCY);
  const atStop = (await q("SELECT COUNT(*) n FROM wa_messages WHERE campaign_id = ?", [camp3]))[0].n;
  await sleep(5000);
  const afterStop = (await q("SELECT COUNT(*) n FROM wa_messages WHERE campaign_id = ?", [camp3]))[0].n;
  const cancelled = (await q("SELECT COUNT(*) n FROM wa_campaign_recipients WHERE campaign_id = ? AND status = 'annule'", [camp3]))[0].n;
  ok(afterStop <= atStop + 1 && cancelled > 0 && (await cp.getCampaign(camp3, AGENCY)).status === "arretee", `arrêt d'urgence : envois stoppés (${afterStop} envoyés, ${cancelled} annulés)`);

  // Campagne planifiée dans le futur : rien n'est envoyé avant l'heure.
  const camp2 = await cp.saveCampaign({ name: "Planifiée", filters: {}, template_name: "promo_a", scheduled_at: new Date(Date.now() + 86400000).toISOString() }, null, AGENCY);
  await cp.submitCampaign(camp2, AGENCY);
  await cp.approveCampaign(camp2, null, AGENCY);
  await sleep(3500);
  ok((await cp.getCampaign(camp2, AGENCY)).status === "validee" && (await q("SELECT COUNT(*) n FROM wa_campaign_recipients WHERE campaign_id = ?", [camp2]))[0].n === 0, "campagne planifiée : aucun envoi avant la date prévue");
  await cp.rejectCampaign(camp2, "Revoir le texte", AGENCY);
  ok((await cp.getCampaign(camp2, AGENCY)).status === "refusee", "campagne refusée avec motif (retour en préparation)");

  // === Pilotage : tableau de bord, statistiques, coûts, rapport (§8.1-8.3) ===
  const dash = await analytics.dashboardData({ scope: "all" }, AGENCY);
  ok(dash.counters.conversations >= 60 && dash.hourly.length === 24 && dash.daily.length === 14, `tableau de bord : ${dash.counters.conversations} conversations, séries horaire et quotidienne`);
  const stats = await analytics.statisticsData({}, AGENCY);
  ok(stats.campaigns.length >= 2 && stats.templates.some((t) => t.name === "promo_b") && stats.bySource.some((r) => r.label === "flyer"), "statistiques : campagnes, templates, entonnoir par source");
  const costs = await analytics.costsData({}, AGENCY);
  ok(costs.meta.total >= 1.5 && costs.meta.byCampaign.some((c) => c.id === camp1) && costs.meta.byCategory.some((c) => c.category === "marketing"), `coûts : Meta ${costs.meta.total} MAD, par catégorie et par campagne`);
  const delivered = await deliverDailyReport(AGENCY);
  ok(delivered.report && /Conversations ouvertes/.test(delivered.report.text) && delivered.mail.sent === true, "rapport quotidien : notification + e-mail");
  const outbox = fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, "utf8").slice(outboxStart) : "";
  ok(/direction@agence\.test/.test(outbox) && /Rapport WhatsApp/.test(outbox), "e-mail du rapport adressé au destinataire paramétré");
  ok((await deliverDailyReport(AGENCY)).skipped != null, "rapport non renvoyé deux fois le même jour");
  const scoped = await analytics.dashboardData({ scope: "own", session: { id: 999999, role: "marketing" } }, AGENCY);
  ok(scoped.counters.conversations === 0 && scoped.alerts.every((a) => ["sla", "urgence"].includes(a.kind)), "tableau de bord limité à son équipe pour un conseiller (matrice §3)");

  // === Contacts : import / export (§8.5) ===
  ok(await expectError(() => contacts.importContactsCsv("telephone;nom\n0661111111;A", null, AGENCY), "VALIDATION"), "import refusé sans colonne de consentement");
  const imp = await contacts.importContactsCsv("telephone;nom;consentement;texte du consentement\n0661111111;Import Oui;oui;Salon 2026\n0662222222;Import Non;non;\n12;Mauvais;oui;", { fullName: "Test" }, AGENCY);
  ok(imp.created === 2 && imp.optedIn === 1 && imp.errors.length === 1, `import CSV : ${imp.created} créés, ${imp.optedIn} consentement, ${imp.errors.length} erreur`);
  const proof = await q("SELECT k.source, k.text_shown FROM wa_consents k JOIN wa_contacts c ON c.id = k.contact_id WHERE c.agency_id = ? AND c.phone = '212661111111'", [AGENCY]);
  ok(proof[0]?.source === "import" && proof[0]?.text_shown === "Salon 2026", "preuve du consentement importé conservée");
  const csv = await contacts.exportContactsCsv({ consent: "oui" }, AGENCY);
  ok(csv.includes("+212661111111") && !csv.includes("+212662222222"), "export CSV filtré (consentants)");

  // === Données personnelles : export, suppression, purge (NF-13) ===
  const exp = await privacy.exportContactData(C2, AGENCY);
  ok(exp.contact.id === C2 && exp.conversations.length >= 1 && exp.conversations[0].messages.length >= 1, "export des données d'un contact (conversations, messages)");
  const dir = path.join(MEDIA_DIR, `l3-${AGENCY}`);
  fs.mkdirSync(dir, { recursive: true });
  const mkMedia = async (contactId, { docType = null, daysAgo = 0 }) => {
    const [conv] = await q("SELECT id FROM wa_conversations WHERE contact_id = ? ORDER BY id DESC LIMIT 1", [contactId]);
    const convId = conv?.id || (await q("INSERT INTO wa_conversations (agency_id, contact_id, status) VALUES (?, ?, 'resolu')", [AGENCY, contactId])).insertId;
    const msg = (await q("INSERT INTO wa_messages (agency_id, conversation_id, direction, author, type, status, processing_status, created_at) VALUES (?, ?, 'entrant', 'client', 'image', 'recu', 'traite', UTC_TIMESTAMP() - INTERVAL ? DAY)", [AGENCY, convId, daysAgo])).insertId;
    const rel = `l3-${AGENCY}/m${msg}.jpg`;
    fs.writeFileSync(path.join(MEDIA_DIR, rel), "fake image");
    await q("INSERT INTO wa_media (agency_id, message_id, kind, storage_path, doc_type, created_at) VALUES (?, ?, 'image', ?, ?, UTC_TIMESTAMP() - INTERVAL ? DAY)", [AGENCY, msg, rel, docType, daysAgo]);
    return path.join(MEDIA_DIR, rel);
  };
  // Passeport d'un voyageur rentré il y a 60 jours (conservation : 30 jours après le retour).
  const pastReg = await runWithAgency(AGENCY, () => createRegistration({ tripId: pastTrip, fullName: "Ancien Pèlerin", phoneWhatsapp: "0607000003", gender: "femme" }));
  await q("UPDATE wa_contacts SET traveler_id = (SELECT traveler_id FROM registrations WHERE id = ?) WHERE id = ?", [pastReg.id, C3]);
  const passportFile = await mkMedia(C3, { docType: "passeport", daysAgo: 70 });
  const oldVoice = await mkMedia(C2, { daysAgo: 200 });
  const freshPassport = await mkMedia(C1, { docType: "passeport", daysAgo: 1 });
  const dry = await privacy.purgeAgencyData(AGENCY, { dryRun: true });
  ok(dry.dryRun && dry.documents === 1 && dry.media === 1 && fs.existsSync(passportFile), `simulation de purge : ${dry.documents} document, ${dry.media} média — rien supprimé`);
  const purged = await privacy.purgeAgencyData(AGENCY);
  ok(!fs.existsSync(passportFile) && !fs.existsSync(oldVoice) && fs.existsSync(freshPassport) && purged.files === 2, "purge : copie de passeport et vieux média supprimés, document récent conservé");
  ok((await q("SELECT COUNT(*) n FROM wa_media WHERE agency_id = ? AND purge_at IS NOT NULL AND storage_path IS NULL", [AGENCY]))[0].n === 2, "trace conservée (document reçu), contenu supprimé");
  ok((await q("SELECT COUNT(*) n FROM registrations WHERE id = ?", [pastReg.id]))[0].n === 1, "le dossier de voyage du CRM n'est pas touché par la purge");
  await privacy.deleteContactData(C1, AGENCY);
  ok(!fs.existsSync(freshPassport) && (await q("SELECT COUNT(*) n FROM wa_contacts WHERE id = ?", [C1]))[0].n === 0 && (await q("SELECT COUNT(*) n FROM wa_conversations WHERE contact_id = ?", [C1]))[0].n === 0, "suppression des données d'un contact (conversations, médias sur disque)");

  // === Audit qualité IA hebdomadaire (NF-15, §8.16) ===
  const convs = await q("SELECT id FROM wa_conversations WHERE agency_id = ? LIMIT 25", [AGENCY]);
  for (const c of convs) await q("INSERT INTO ia_logs (agency_id, conversation_id, context, model, cost_usd, outcome, created_at) VALUES (?, ?, 'conversation', 'claude-sonnet-5-5', 0.01, 'reponse', UTC_TIMESTAMP() - INTERVAL 2 DAY)", [AGENCY, c.id]);
  const auditId = await journal.createWeeklyAudit(null, AGENCY);
  const audit = await journal.getAudit(auditId, AGENCY);
  ok(audit.items.length === 20 && new Set(audit.items.map((i) => i.conversation_id)).size === 20, `audit : ${audit.items.length} conversations tirées au hasard`);
  ok(await expectError(() => journal.reviewAuditItem(audit.items[0].id, { tone: 4 }, null, AGENCY), "VALIDATION"), "grille : exactitude et ton obligatoires");
  await journal.reviewAuditItem(audit.items[0].id, { accuracy: 2, tone: 4, transfer_ok: false, invented_info: true, comment: "Prix inventé" }, null, AGENCY);
  ok((await q("SELECT COUNT(*) n FROM staff_notifications WHERE agency_id = ? AND kind = 'audit_ia'", [AGENCY]))[0].n === 1, "information inventée : direction alertée (tolérance zéro)");
  for (const it of audit.items.slice(1)) await journal.reviewAuditItem(it.id, { accuracy: 5, tone: 5, transfer_ok: true }, null, AGENCY);
  const audits = await journal.listAudits(AGENCY);
  ok(audits[0].status === "termine" && Number(audits[0].invented) === 1 && Number(audits[0].reviewed) === 20, "audit terminé, moyenne et informations inventées comptées");
  const logs = await journal.listIaLogs({}, {}, AGENCY);
  ok(logs.total >= 25, `logs IA filtrables (${logs.total})`);

  // === Double authentification et verrouillage (NF-07) — vrais appels HTTP ===
  // Vecteur de test RFC 6238 (secret « 12345678901234567890 », t = 59 s → 287082).
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));
  ok(totpCode(rfcSecret, 59_000) === "287082" && verifyTotp(rfcSecret, "287082", 59_000) && !verifyTotp(rfcSecret, "000000", 59_000), "TOTP conforme à la RFC 6238");
  const password = crypto.randomBytes(9).toString("base64url");
  await q("INSERT INTO staff_users (full_name, email, password_hash, role_id, agency_id) VALUES ('Direction Test', 'dir@l3.test', ?, ?, ?)", [await hashPassword(password), roleIds.direction, AGENCY]);
  await q("INSERT INTO staff_users (full_name, email, password_hash, role_id, agency_id) VALUES ('Ventes Test', 'ventes@l3.test', ?, ?, ?)", [await hashPassword(password), roleIds.ventes, AGENCY]);
  const login1 = await call("POST", "/api/auth/login", { body: { email: "dir@l3.test", password } });
  ok(login1.status === 200 && login1.json?.mfaSetupRequired === true && login1.cookie, "direction sans 2FA : connexion limitée à l'activation");
  const blocked = await call("GET", "/api/admin/whatsapp/dashboard", { cookie: login1.cookie });
  ok(blocked.status === 403, "toutes les API admin refusées tant que la 2FA n'est pas activée");
  const start = await call("POST", "/api/admin/security", { body: { action: "start" }, cookie: login1.cookie });
  ok(start.status === 200 && /^otpauth:\/\/totp\//.test(start.json?.otpauth || "") && /^data:image\/png/.test(start.json?.qr || ""), "activation : code QR et clé générés");
  const bad = await call("POST", "/api/admin/security", { body: { action: "confirm", code: "000000" }, cookie: login1.cookie });
  const confirm = await call("POST", "/api/admin/security", { body: { action: "confirm", code: totpCode(start.json.secret) }, cookie: login1.cookie });
  ok(bad.status === 400 && confirm.status === 200 && confirm.cookie, "activation confirmée par un code valide (code faux refusé)");
  const dashOk = await call("GET", "/api/admin/whatsapp/dashboard", { cookie: confirm.cookie });
  ok(dashOk.status === 200 && dashOk.json?.counters, "accès complet rétabli après activation");
  const login2 = await call("POST", "/api/auth/login", { body: { email: "dir@l3.test", password } });
  const login3 = await call("POST", "/api/auth/login", { body: { email: "dir@l3.test", password, totp: "123456" } });
  const login4 = await call("POST", "/api/auth/login", { body: { email: "dir@l3.test", password, totp: totpCode(start.json.secret) } });
  ok(login2.json?.mfaRequired === true && !login2.cookie && login3.status === 401 && login4.status === 200 && login4.cookie, "connexion : mot de passe puis code TOTP exigé");
  const ventesLogin = await call("POST", "/api/auth/login", { body: { email: "ventes@l3.test", password } });
  ok(ventesLogin.status === 200 && ventesLogin.json?.mfaSetupRequired === false, "2FA non imposée aux rôles non concernés");
  const ventesCosts = await call("GET", "/api/admin/whatsapp/costs", { cookie: ventesLogin.cookie });
  const ventesCamp = await call("GET", "/api/admin/whatsapp/campaigns", { cookie: ventesLogin.cookie });
  const ventesDash = await call("GET", "/api/admin/whatsapp/dashboard", { cookie: ventesLogin.cookie });
  ok(ventesCosts.status === 403 && ventesCamp.status === 403 && ventesDash.status === 200, "conseiller : pas d'accès aux coûts ni aux campagnes, tableau de bord autorisé");
  let lastStatus = 0;
  for (let i = 0; i < 5; i += 1) lastStatus = (await call("POST", "/api/auth/login", { body: { email: "ventes@l3.test", password: "mauvais-mot-de-passe" } })).status;
  const locked = await call("POST", "/api/auth/login", { body: { email: "ventes@l3.test", password } });
  ok(lastStatus === 401 && locked.status === 423, "compte verrouillé après 5 échecs (même avec le bon mot de passe)");

  // === Limitation de débit (NF-10) ===
  const statuses = [];
  for (let i = 0; i < 6; i += 1) statuses.push((await call("POST", "/api/contact", { body: { fullName: "Spam", email: "spam@test.local", message: "x" } })).status);
  ok(statuses.slice(0, 5).every((st) => st === 201) && statuses[5] === 429, `formulaire public limité (5 / 10 min) : ${statuses.join(", ")}`);

  // === Isolation inter-agences ===
  const a1 = await runWithAgency(1, async () => ({ camps: await cp.listCampaigns(), seg: await cp.previewSegment({}) }));
  ok(!a1.camps.some((c) => c.id === camp1) && (await expectError(() => contacts.getContactDetail(C2, 1), "NOT_FOUND")), "isolation : l'agence 1 ne voit ni les campagnes ni les contacts de l'agence test");

  // === Sauvegarde chiffrée et restauration vérifiée (NF-14) ===
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-backup-test-"));
  const runScript = (script, args = []) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ["--env-file=.env", script, ...args], { env: { ...process.env, BACKUP_DIR: backupDir }, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code, out }));
    });
  const bk = await runScript("scripts/backup.mjs");
  const set = fs.readdirSync(backupDir).find((n) => /^\d{8}-\d{6}$/.test(n));
  ok(bk.code === 0 && set && fs.existsSync(path.join(backupDir, set, "database.sql.gz.enc")), "sauvegarde chiffrée créée (base + fichiers + manifeste)");
  const raw = fs.readFileSync(path.join(backupDir, set, "database.sql.gz.enc"));
  ok(raw.subarray(0, 5).toString() === "GFBK1" && !raw.includes(Buffer.from("CREATE TABLE")), "contenu illisible sans la clé (AES-256-GCM)");
  const rs = await runScript("scripts/restore.mjs", [path.join(backupDir, set), "--verify"]);
  ok(rs.code === 0 && /RESTAURATION OK/.test(rs.out), "restauration vérifiée dans une base temporaire : tables identiques au manifeste");
} catch (err) {
  failures += 1;
  console.error("ERREUR", err);
} finally {
  if (failures) console.log("\n--- journal du worker ---\n" + workerLog.slice(-6000));
  await cleanup();
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrôles passent.");
process.exit(failures ? 1 : 0);
