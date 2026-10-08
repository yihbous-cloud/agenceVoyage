// Recette automatisée du Lot 2 WhatsApp : templates Meta, déclencheurs,
// liens wa.me / QR, boutons interactifs, paiement en ligne.
// Sans aucun appel réel : faux serveurs Meta (4010), Stripe (4012) et
// PayPal (4013) ; worker lancé par le script, limité à l'agence TEMPORAIRE
// (WA_WORKER_AGENCY_IDS), supprimée à la fin.
//   Prérequis : npm run dev (port 3000 ou WA_TEST_BASE_URL) + Redis.
//   npm run test:whatsapp-lot2
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const BASE_URL = process.env.WA_TEST_BASE_URL || "http://localhost:3000";
process.env.META_GRAPH_BASE_URL = "http://127.0.0.1:4010";
process.env.STRIPE_API_BASE = "http://127.0.0.1:4012";
process.env.PAYPAL_API_BASE = "http://127.0.0.1:4013";

const { setScriptAgencyId, runWithAgency } = await import("../lib/agencyContext.js");
const { saveAccount } = await import("../lib/whatsapp/accounts.js");
const tpl = await import("../lib/whatsapp/templates.js");
const trg = await import("../lib/whatsapp/triggers.js");
const links = await import("../lib/whatsapp/links.js");
const { sendConversationInteractive } = await import("../lib/whatsapp/outbound.js");
const { createRegistration } = await import("../lib/registrations.js");
const online = await import("../lib/payments/online.js");
const { captureOrder } = await import("../lib/payments/gateways/paypal.js");
const { checkoutForm, cmiHash } = await import("../lib/payments/gateways/cmi.js");
const { signMetaPayload } = await import("../lib/whatsapp/signature.js");
const { localParts } = await import("../lib/whatsapp/team.js");
const { getPool } = await import("../lib/db.js");

const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(400);
  }
  return null;
}
const serve = (port, handler) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => handler(req, res, body));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
const json = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

// --- Faux serveurs --------------------------------------------------------------
const meta = { sent: [], created: [], remoteTemplates: [] };
const metaServer = await serve(4010, (req, res, body) => {
  const data = body ? JSON.parse(body) : {};
  if (req.method === "POST" && /\/messages$/.test(req.url)) {
    if (data.status === "read") return json(res, 200, { success: true });
    meta.sent.push(data);
    return json(res, 200, { messages: [{ id: `wamid.lot2.${meta.sent.length}.${Date.now()}` }] });
  }
  if (req.method === "POST" && /\/message_templates$/.test(req.url)) {
    meta.created.push(data);
    return json(res, 200, { id: `tpl_${meta.created.length}`, status: "PENDING", category: data.category });
  }
  if (req.method === "GET" && /\/message_templates/.test(req.url)) return json(res, 200, { data: meta.remoteTemplates });
  return json(res, 200, {});
});
const stripe = { sessions: [] };
const stripeServer = await serve(4012, (req, res, body) => {
  const form = Object.fromEntries(new URLSearchParams(body));
  stripe.sessions.push(form);
  return json(res, 200, { id: `cs_test_${stripe.sessions.length}`, url: `https://checkout.stripe.test/${stripe.sessions.length}` });
});
const paypalServer = await serve(4013, (req, res, body) => {
  if (req.url.endsWith("/v1/oauth2/token")) return json(res, 200, { access_token: "tok" });
  if (req.url.endsWith("/v2/checkout/orders")) {
    const order = JSON.parse(body);
    paypalServer.lastOrder = order;
    return json(res, 201, { id: "ORDER123", links: [{ rel: "approve", href: "https://paypal.test/approve/ORDER123" }] });
  }
  if (req.url.includes("/capture")) {
    const unit = paypalServer.lastOrder.purchase_units[0];
    return json(res, 201, { status: "COMPLETED", purchase_units: [{ custom_id: unit.custom_id, payments: { captures: [{ amount: unit.amount }] } }] });
  }
  return json(res, 404, {});
});

// --- Agence temporaire ----------------------------------------------------------
const SUB = `wa-lot2-${Date.now() % 100000}`;
const AGENCY = (await q("INSERT INTO agencies (name, subdomain, phone, address, city) VALUES (?, ?, ?, ?, ?)", ["Agence Lot2", SUB, "0522000000", "1 rue Test", "Casablanca"])).insertId;
for (const name of ["direction", "ventes", "comptabilite", "suivi"]) await q("INSERT INTO roles (name, description, agency_id) VALUES (?, ?, ?)", [name, name, AGENCY]);
const PHONE_NUMBER_ID = String(920000000000 + Math.floor(Math.random() * 99999999));
const APP_SECRET = crypto.randomBytes(16).toString("hex");
setScriptAgencyId(AGENCY);
await saveAccount({ phoneNumberId: PHONE_NUMBER_ID, wabaId: "WABA_TEST", displayPhone: "+212 600 111 222", status: "actif", accessToken: "tok", appSecret: APP_SECRET });
const program = (await q("INSERT INTO programs (title, slug, family, agency_id, is_published) VALUES ('Omra Test Lot2', ?, 'omra_hajj', ?, TRUE)", [`omra-lot2-${AGENCY}`, AGENCY])).insertId;
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const trip = (await q(
  "INSERT INTO trips (program_id, reference_code, departure_date, return_date, price_double, status, agency_id, pnr) VALUES (?, ?, ?, ?, 15000, 'ouvert', ?, NULL)",
  [program, `L2-${AGENCY}`, inDays(30), inDays(44), AGENCY]
)).insertId;
const tripJ7 = (await q(
  "INSERT INTO trips (program_id, reference_code, departure_date, return_date, price_double, status, agency_id) VALUES (?, ?, ?, ?, 15000, 'ouvert', ?)",
  [program, `L2B-${AGENCY}`, localParts().date, inDays(14), AGENCY]
)).insertId;
await q("UPDATE trips SET departure_date = DATE_ADD(?, INTERVAL 7 DAY) WHERE id = ?", [localParts().date, tripJ7]);

let worker;
let workerLog = "";
function startWorker() {
  worker = spawn(process.execPath, ["--env-file=.env", "--import", "./scripts/esm-register.mjs", "worker/index.mjs"], {
    env: { ...process.env, WA_WORKER_AGENCY_IDS: String(AGENCY), WA_ECHO_TEST: "0", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.on("data", (d) => (workerLog += d));
  worker.stderr.on("data", (d) => (workerLog += d));
}
let seq = 0;
async function inbound(waId, text) {
  seq += 1;
  const ts = Math.floor(Date.now() / 1000);
  const payload = { object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ profile: { name: "Client" }, wa_id: waId }], messages: [{ from: waId, id: `wamid.l2.in.${seq}.${ts}`, timestamp: String(ts), type: "text", text: { body: text } }] } }] }] };
  return webhook(payload);
}
// Requête vers le sous-domaine de l'agence de test (Node ne résout pas *.localhost).
function getWithHost(pathname) {
  const url = new URL(BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, path: pathname, method: "GET", headers: { host: `${SUB}.localhost:${url.port}` } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location || "", body }));
    });
    req.on("error", reject);
    req.end();
  });
}
function webhook(payload) {
  const body = JSON.stringify(payload);
  return fetch(`${BASE_URL}/api/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signMetaPayload(body, APP_SECRET) }, body });
}
const templateWebhook = (field, value) => webhook({ object: "whatsapp_business_account", entry: [{ id: "WABA_TEST", changes: [{ field, value: { ...value } }] }] });

async function cleanup() {
  if (worker) worker.kill("SIGINT");
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
  for (const s of [metaServer, stripeServer, paypalServer]) s.close();
  await pool.end();
}

try {
  // === Templates ===
  const created = await tpl.seedDefaultTemplates(AGENCY);
  ok(created === 42, `21 templates × 2 langues chargés en brouillon (${created})`);
  const all = await tpl.listTemplates(AGENCY);
  ok(all.every((t) => tpl.validateTemplate({ name: t.name, language: t.language, category: t.category_requested, simple: t.simple, mapping: t.variable_mapping }).errors.length === 0), "les 42 brouillons respectent les règles Meta");
  const bad = tpl.validateTemplate({ name: "Mauvais Nom", language: "fr", category: "UTILITY", simple: { headerType: "NONE", body: "{{1}} bonjour {{3}}", footer: "", buttons: [] }, mapping: {} });
  ok(bad.errors.length >= 3, "contrôles : nom, variable en début, variables non consécutives détectés");
  const promo = tpl.validateTemplate({ name: "x", language: "fr", category: "UTILITY", simple: { headerType: "NONE", body: "Bonjour {{1}}, profitez de notre réduction exceptionnelle.", footer: "", buttons: [] }, mapping: { "body.1": "contact.prenom" } });
  ok(promo.warnings.some((w) => /Marketing/.test(w)), "avertissement : mots promotionnels dans un template Utilité (TP-03)");

  const welcomeFr = all.find((t) => t.name === "gf_inscription_confirmee" && t.language === "fr");
  const submitted = await tpl.submitTemplate(welcomeFr.id, {}, AGENCY);
  const sentToMeta = meta.created[0];
  ok(submitted.status === "PENDING" && sentToMeta?.name === "gf_inscription_confirmee" && sentToMeta.category === "UTILITY", "soumission à Meta : statut « en attente » (TP-01)");
  const bodyComp = sentToMeta?.components.find((c) => c.type === "BODY");
  ok(bodyComp?.example?.body_text?.[0]?.length === 4, "exemples des 4 variables joints à la soumission");

  startWorker();
  await sleep(2500);

  // Statut et reclassement par webhook (TP-02, TP-03).
  await templateWebhook("message_template_status_update", { event: "APPROVED", message_template_id: submitted.meta_template_id, message_template_name: submitted.name, message_template_language: "fr" });
  const approved = await waitFor(async () => (await tpl.getTemplate(welcomeFr.id, AGENCY)).status === "APPROVED");
  ok(Boolean(approved), "webhook Meta : template approuvé");
  await templateWebhook("template_category_update", { message_template_id: submitted.meta_template_id, previous_category: "UTILITY", new_category: "MARKETING" });
  const reclassed = await waitFor(async () => (await q("SELECT id FROM staff_notifications WHERE agency_id = ? AND kind = 'template_reclasse'", [AGENCY]))[0]);
  ok(Boolean(reclassed), "reclassement Utilité → Marketing : alerte direction (TP-03)");
  await q("UPDATE wa_templates SET category = 'UTILITY' WHERE id = ?", [welcomeFr.id]);

  // Synchronisation depuis Meta.
  meta.remoteTemplates = [{ id: "tpl_remote", name: "gf_paiement_recu", language: "fr", status: "APPROVED", category: "UTILITY", components: (all.find((t) => t.name === "gf_paiement_recu" && t.language === "fr")).components }];
  await tpl.syncTemplates(AGENCY);
  const payFr = (await tpl.listTemplates(AGENCY)).find((t) => t.name === "gf_paiement_recu" && t.language === "fr");
  ok(payFr.status === "APPROVED", "synchronisation : statut mis à jour depuis Meta (TP-02)");

  // === Déclencheurs ===
  const seeded = await trg.seedDefaultTriggers(AGENCY);
  const triggers = await trg.listTriggers(AGENCY);
  ok(seeded === 27 && triggers.every((t) => !t.is_active), `27 déclencheurs chargés, tous inactifs (${seeded})`);
  const byCode = (code) => triggers.find((t) => t.code === code);
  // Activation + plages d'envoi larges pour un test déterministe (00:00-23:59).
  for (const code of ["inscription_confirmee", "paiement_recu", "rappel_depart_j7", "prospect_chaud"]) {
    await q("UPDATE wa_triggers SET is_active = TRUE, delay_minutes = 0, allowed_start = '00:00', allowed_end = '23:59', skip_friday_prayer = FALSE WHERE id = ?", [byCode(code).id]);
  }

  // Événement « inscription créée » → template approuvé envoyé (fenêtre fermée).
  const reg = await runWithAgency(AGENCY, () => createRegistration({ tripId: trip, fullName: "Fatima Zahra Test", phoneWhatsapp: "0600111001", gender: "femme" }));
  const welcomeSent = await waitFor(() => meta.sent.find((m) => m.type === "template" && m.template?.name === "gf_inscription_confirmee"), 90000);
  ok(Boolean(welcomeSent), "événement inscription → template envoyé (DC-01)");
  const params = welcomeSent?.template?.components?.[0]?.parameters?.map((p) => p.text) || [];
  ok(params[0] === "Fatima" && params[1] === "Omra Test Lot2" && params[3] === `GF-${reg.id}`, `variables remplies depuis le CRM (${params.join(" | ")})`);
  const run1 = await waitFor(async () => (await q("SELECT * FROM wa_trigger_runs WHERE agency_id = ? AND trigger_id = ? AND status <> 'planifie'", [AGENCY, byCode("inscription_confirmee").id]))[0], 20000);
  ok(run1?.status === "envoye" && run1.channel === "template", "historique : exécution « envoyé », canal template (DC-08)");

  // Fenêtre 24h ouverte → texte libre gratuit (DC-03).
  await inbound("212600111001", "Merci !");
  await sleep(1500);
  const { createPayment } = await import("../lib/payments.js");
  await runWithAgency(AGENCY, () => createPayment(reg.id, { amount: 5000, paymentMethod: "especes" }, null));
  const freeText = await waitFor(() => meta.sent.find((m) => m.type === "text" && /5 000 MAD/.test(m.text?.body || "")), 90000);
  ok(Boolean(freeText), "fenêtre 24h ouverte : confirmation de paiement envoyée en texte libre (DC-03)");
  if (!freeText) console.log("DIAG runs paiement :", await q("SELECT status, channel, result, scheduled_at FROM wa_trigger_runs WHERE agency_id = ? AND trigger_id = ?", [AGENCY, byCode("paiement_recu").id]), "envois :", meta.sent.slice(-3).map((m) => m.type + ":" + (m.text?.body || m.template?.name)));

  // Date relative J-7 : planification + simulation.
  const reg7 = await runWithAgency(AGENCY, () => createRegistration({ tripId: tripJ7, fullName: "Youssef J7", phoneWhatsapp: "0600111002", gender: "homme" }));
  const sim = await trg.simulateTrigger(byCode("rappel_depart_j7").id, AGENCY);
  ok(sim.targets.some((x) => x.name === "Youssef J7"), "simulation J-7 : le voyageur concerné est listé, rien n'est envoyé");
  const planned = await trg.planScheduledTriggers(AGENCY);
  ok(planned >= 1, "planification J-7 effectuée (DC-01 date relative)");
  void reg7;

  // Plages d'envoi : hors plage → reporté (DC-06).
  const quiet = { ...byCode("rappel_depart_j7"), urgent: false, skip_friday_prayer: false, allowed_start: "00:00", allowed_end: "00:01" };
  const next = trg.nextAllowedTime(quiet, new Date());
  ok(!trg.isAllowedTime(quiet, new Date()) || next > new Date(), "hors plage d'envoi : envoi reporté à la prochaine plage");
  ok(trg.isAllowedTime({ ...quiet, urgent: true }, new Date()), "urgent : ignore les plages d'envoi");

  // Condition d'arrêt : le client répond avant l'envoi (DC-05).
  const stopTrig = await trg.saveTrigger({ name: "Test arrêt", family: "evenement", event_type: "visa_en_cours", template_name: "gf_visa_en_cours", delay_minutes: 1, stop_conditions: ["reponse_client"], allowed_start: "00:00", allowed_end: "23:59", skip_friday_prayer: false }, AGENCY);
  await q("UPDATE wa_triggers SET is_active = TRUE WHERE id = ?", [stopTrig.id]);
  await trg.handleCrmEvent(AGENCY, { type: "visa_en_cours", registrationId: reg.id });
  // Le client répond APRÈS la planification, AVANT l'envoi.
  await q("UPDATE wa_trigger_runs SET created_at = UTC_TIMESTAMP() - INTERVAL 2 MINUTE, scheduled_at = UTC_TIMESTAMP() + INTERVAL 1 HOUR WHERE trigger_id = ?", [stopTrig.id]);
  await inbound("212600111001", "Ok merci");
  await sleep(1500);
  await q("UPDATE wa_trigger_runs SET scheduled_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE trigger_id = ?", [stopTrig.id]);
  const stopped = await waitFor(async () => (await q("SELECT status, result FROM wa_trigger_runs WHERE trigger_id = ?", [stopTrig.id]))[0]?.status === "annule", 90000);
  ok(Boolean(stopped), "arrêt automatique : le client a répondu, envoi annulé (DC-05)");

  // Marketing sans consentement → ignoré (DC-04).
  const mk = await trg.saveTrigger({ name: "Test marketing", family: "evenement", event_type: "visa_accorde", template_name: "gf_relance_prospect", allowed_start: "00:00", allowed_end: "23:59", skip_friday_prayer: false }, AGENCY);
  await q("UPDATE wa_triggers SET is_active = TRUE WHERE id = ?", [mk.id]);
  await trg.handleCrmEvent(AGENCY, { type: "visa_accorde", registrationId: reg.id });
  const [mkRun] = await q("SELECT id FROM wa_trigger_runs WHERE trigger_id = ?", [mk.id]);
  await trg.executeRun(AGENCY, mkRun.id);
  const [mkAfter] = await q("SELECT status, result FROM wa_trigger_runs WHERE id = ?", [mkRun.id]);
  ok(mkAfter.status === "ignore" && /consentement/.test(mkAfter.result), "marketing sans consentement : non envoyé (DC-04)");

  // Interne : prospect qualifié → notification ventes (DC-10).
  const [contact] = await q("SELECT id FROM wa_contacts WHERE agency_id = ? LIMIT 1", [AGENCY]);
  await trg.handleCrmEvent(AGENCY, { type: "prospect_qualifie", contactId: contact.id });
  const [intRun] = await q("SELECT id FROM wa_trigger_runs WHERE trigger_id = ?", [byCode("prospect_chaud").id]);
  await trg.executeRun(AGENCY, intRun.id);
  const [hot] = await q("SELECT * FROM staff_notifications WHERE agency_id = ? AND kind = 'declencheur' AND team = 'ventes'", [AGENCY]);
  ok(Boolean(hot), "déclencheur interne : prospect chaud notifié à l'équipe ventes (DC-10)");

  // Rapport quotidien (DC-10).
  const report = byCode("rapport_quotidien");
  await q("UPDATE wa_triggers SET is_active = TRUE, allowed_start = '00:00', allowed_end = '23:59' WHERE id = ?", [report.id]);
  const rr = await q("INSERT INTO wa_trigger_runs (agency_id, trigger_id, dedupe_key, status, scheduled_at) VALUES (?, ?, 'rapport-test', 'planifie', UTC_TIMESTAMP())", [AGENCY, report.id]);
  await trg.executeRun(AGENCY, rr.insertId);
  const [rep] = await q("SELECT title, body FROM staff_notifications WHERE agency_id = ? AND kind = 'rapport'", [AGENCY]);
  ok(/Conversations ouvertes : \d+/.test(rep?.body || ""), "rapport quotidien généré pour la direction (DC-10)");

  // === Liens wa.me / QR ===
  await links.createLink({ code: "flyer-test", label: "Flyer", prefilledMessage: "Salam, infos Omra" }, null, AGENCY);
  const [link] = await links.listLinks(AGENCY);
  ok(link.code === "FLYER-TEST" && link.url === `https://wa.me/212600111222?text=${encodeURIComponent("Salam, infos Omra [FLYER-TEST]")}`, "lien wa.me avec code source (CP-07)");
  await inbound("212600111099", "Salam, infos Omra [FLYER-TEST]");
  const src = await waitFor(async () => (await q("SELECT source FROM wa_contacts WHERE agency_id = ? AND phone = '212600111099'", [AGENCY]))[0]?.source);
  ok(src === "lien:FLYER-TEST", "source attribuée au nouveau contact depuis le code du lien");
  ok(Number((await links.listLinks(AGENCY))[0].contacts) === 1, "statistiques du lien : 1 contact");

  // === Boutons interactifs (IA-12) ===
  const [conv] = await q("SELECT c.id FROM wa_conversations c JOIN wa_contacts ct ON ct.id = c.contact_id WHERE ct.phone = '212600111099' AND c.agency_id = ?", [AGENCY]);
  await sendConversationInteractive(AGENCY, conv.id, { body: "Quel voyage ?", options: [{ titre: "Omra" }, { titre: "Hajj" }] });
  const inter = meta.sent.find((m) => m.type === "interactive");
  ok(inter?.interactive?.type === "button" && inter.interactive.action.buttons.length === 2, "message à boutons cliquables envoyé (IA-12)");

  // === Paiement en ligne ===
  await online.saveGateway("stripe", { isActive: true, secrets: { secretKey: "sk_test_x", webhookSecret: "whsec_test" } }, AGENCY);
  const gws = await online.listGateways(AGENCY);
  const sg = gws.find((g) => g.provider === "stripe");
  ok(sg.isActive && sg.mode === "test" && sg.secretsSet.secretKey && !JSON.stringify(gws).includes("sk_test_x"), "passerelle Stripe : secrets chiffrés, jamais renvoyés, mode test");
  const regPay = await runWithAgency(AGENCY, () => createRegistration({ tripId: trip, fullName: "Client Paiement", phoneWhatsapp: "0600111003", gender: "homme", totalDue: 10000 }));
  let tooMuch = null;
  try {
    await online.createPaymentLink({ provider: "stripe", registrationId: regPay.id, amount: 20000 }, null, AGENCY);
  } catch (err) {
    tooMuch = err;
  }
  ok(tooMuch?.code === "VALIDATION", "montant supérieur au reste à payer refusé");
  const plink = await online.createPaymentLink({ provider: "stripe", registrationId: regPay.id, amount: 4000 }, null, AGENCY);
  ok(stripe.sessions[0]?.["line_items[0][price_data][unit_amount]"] === "400000" && stripe.sessions[0].client_reference_id === plink.reference, "session Stripe : montant fixé côté serveur + référence");
  const page = await getWithHost(`/api/paiement/${plink.reference}`);
  ok(page.status === 303 && /checkout\.stripe\.test/.test(page.location), "lien client : redirection vers la passerelle");
  const event = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_1", client_reference_id: plink.reference, payment_status: "paid", amount_total: 400000, currency: "mad" } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = (secret) => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${event}`).digest("hex")}`;
  const badHook = await fetch(`${BASE_URL}/api/webhooks/paiement/stripe`, { method: "POST", headers: { "Stripe-Signature": sig("mauvais") }, body: event });
  ok(badHook.status === 400 && (await q("SELECT COUNT(*) n FROM payments WHERE registration_id = ?", [regPay.id]))[0].n == 0, "notification mal signée refusée, rien enregistré");
  const goodHook = await fetch(`${BASE_URL}/api/webhooks/paiement/stripe`, { method: "POST", headers: { "Stripe-Signature": sig("whsec_test") }, body: event });
  await fetch(`${BASE_URL}/api/webhooks/paiement/stripe`, { method: "POST", headers: { "Stripe-Signature": sig("whsec_test") }, body: event });
  const pays = await q("SELECT amount, payment_method FROM payments WHERE registration_id = ?", [regPay.id]);
  ok(goodHook.status === 200 && pays.length === 1 && Number(pays[0].amount) === 4000 && pays[0].payment_method === "carte", "notification signée : paiement enregistré une seule fois (idempotent)");
  const [regAfter] = await q("SELECT status FROM registrations WHERE id = ?", [regPay.id]);
  ok(regAfter.status === "paye_partiel", "statut du dossier recalculé (payé partiel)");

  // CMI : hash ver3 + notification signée.
  await online.saveGateway("cmi", { isActive: true, publicConfig: { clientId: "600000000" }, secrets: { storeKey: "TEST1234" } }, AGENCY);
  const clink = await online.createPaymentLink({ provider: "cmi", registrationId: regPay.id, amount: 1000 }, null, AGENCY);
  const form = checkoutForm({ secrets: { storeKey: "TEST1234" }, publicConfig: { clientId: "600000000" }, amount: 1000, reference: clink.reference, successUrl: "https://x/ok", cancelUrl: "https://x/ko", callbackUrl: "https://x/cb" });
  ok(form.params.HASH === cmiHash(Object.fromEntries(Object.entries(form.params).filter(([k]) => k !== "HASH")), "TEST1234"), "CMI : formulaire signé (hash ver3)");
  const cmiParams = { oid: clink.reference, amount: "1000.00", ProcReturnCode: "00", Response: "Approved", TransId: "T1", clientid: "600000000" };
  cmiParams.HASH = cmiHash(cmiParams, "TEST1234");
  const cmiRes = await fetch(`${BASE_URL}/api/webhooks/paiement/cmi`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(cmiParams) });
  ok((await cmiRes.text()) === "ACTION=POSTAUTH" && (await q("SELECT COUNT(*) n FROM payments WHERE registration_id = ?", [regPay.id]))[0].n == 2, "CMI : notification vérifiée, paiement enregistré, POSTAUTH");

  // PayPal : conversion MAD → EUR, capture serveur.
  await online.saveGateway("paypal", { isActive: true, publicConfig: { clientId: "cid", currency: "EUR", rateFromMad: "0.092" }, secrets: { clientSecret: "sec" } }, AGENCY);
  const pl = await online.createPaymentLink({ provider: "paypal", registrationId: regPay.id, amount: 1000 }, null, AGENCY);
  ok(paypalServer.lastOrder?.purchase_units?.[0]?.amount?.currency_code === "EUR" && paypalServer.lastOrder.purchase_units[0].amount.value === "92.00", "PayPal : montant converti en EUR (92.00)");
  const linkRow = await online.findLinkByReference(pl.reference);
  const rt = await online.runtimeForLink(linkRow);
  const capture = await captureOrder({ ...rt, orderId: "ORDER123" });
  const conf = capture.paid ? await online.confirmLinkPayment(linkRow, { amount: linkRow.amount, externalId: "ORDER123", event: capture.event }) : null;
  ok(conf?.recorded === true, "PayPal : capture serveur confirmée, paiement enregistré");

  // Virement : instructions affichées.
  await online.saveGateway("virement", { isActive: true, publicConfig: { instructions: "RIB 007 000 1234" } }, AGENCY);
  const vl = await online.createPaymentLink({ provider: "virement", registrationId: regPay.id, amount: 500 }, null, AGENCY);
  const vpage = (await getWithHost(`/api/paiement/${vl.reference}`)).body;
  ok(/RIB 007 000 1234/.test(vpage) && vpage.includes(vl.reference), "virement : instructions et référence affichées");

  // Isolation : l'agence 1 ne voit rien.
  const a1 = await runWithAgency(1, async () => ({ t: await tpl.listTemplates(), d: await trg.listTriggers(), l: await online.listPaymentLinks() }));
  ok(!a1.t.some((x) => x.agency_id === AGENCY) && !a1.d.some((x) => x.agency_id === AGENCY) && !a1.l.some((x) => x.agency_id === AGENCY), "isolation : l'agence 1 ne voit ni templates, ni déclencheurs, ni liens de l'agence test");
} catch (err) {
  failures += 1;
  console.error("ERREUR", err);
} finally {
  if (failures) console.log("\n--- journal du worker ---\n" + workerLog.slice(-6000));
  await cleanup();
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrôles passent.");
process.exit(failures ? 1 : 0);
