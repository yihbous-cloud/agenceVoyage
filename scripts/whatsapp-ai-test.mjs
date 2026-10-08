// Recette automatisée du Lot 1 WhatsApp (agent IA, transfert, copilote...).
// Sans aucun appel réel : un faux serveur Claude (ANTHROPIC_BASE_URL) et un
// faux serveur Meta (META_GRAPH_BASE_URL) remplacent les API externes ; le
// script lance son propre worker pointé dessus. Agence TEMPORAIRE, supprimée
// à la fin.
//   Prérequis : serveur Next.js (npm run dev, port 3000 ou WA_TEST_BASE_URL) + Redis.
//   npm run test:whatsapp-ai
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { setScriptAgencyId, runWithAgency } from "../lib/agencyContext.js";
import { saveAccount } from "../lib/whatsapp/accounts.js";
import { saveSettingsVersion, getActiveSettings } from "../lib/ai/settings.js";
import { signMetaPayload } from "../lib/whatsapp/signature.js";
import { listConversations, approveDraft } from "../lib/whatsapp/conversations.js";
import { runSandbox } from "../lib/ai/sandbox.js";
import { getPool } from "../lib/db.js";

const BASE_URL = process.env.WA_TEST_BASE_URL || "http://localhost:3000";
// Ce processus envoie aussi (validation d'un brouillon) : vers le faux Meta.
process.env.META_GRAPH_BASE_URL = "http://127.0.0.1:4010";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:4011";
process.env.ANTHROPIC_API_KEY = "test-key";
const META_PORT = 4010;
const CLAUDE_PORT = 4011;
const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(300);
  }
  return null;
}

// --- Faux Meta --------------------------------------------------------------
const sent = [];
const meta = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.method === "POST" && /\/messages$/.test(req.url)) {
      const data = JSON.parse(body || "{}");
      if (data.status === "read") return res.end(JSON.stringify({ success: true }));
      sent.push(data);
      return res.end(JSON.stringify({ messages: [{ id: `wamid.mock.${sent.length}.${Date.now()}` }] }));
    }
    res.end(JSON.stringify({}));
  });
});
await new Promise((r) => meta.listen(META_PORT, "127.0.0.1", r));

// --- Faux Claude --------------------------------------------------------------
const claudeRequests = [];
function lastUserText(messages) {
  const last = messages[messages.length - 1];
  const blocks = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
  return blocks.filter((b) => b.type === "text").map((b) => b.text).join(" ");
}
function reply(content, stop = "end_turn", model = "claude-sonnet-5-5") {
  return {
    id: `msg_${crypto.randomBytes(6).toString("hex")}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
  };
}
const claude = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const data = JSON.parse(body || "{}");
    claudeRequests.push(data);
    const send = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (String(data.model).includes("haiku")) return send(200, reply([{ type: "text", text: "- Client intéressé par une Omra\n- Veut réserver" }], "end_turn", data.model));
    const last = data.messages[data.messages.length - 1];
    const hasToolResult = Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
    if (hasToolResult) {
      const result = last.content.find((b) => b.type === "tool_result");
      const parsed = JSON.parse(result.content);
      if (parsed.transfert) return send(200, reply([{ type: "text", text: `D'accord, ${parsed.a_dire_au_client || "un conseiller arrive"}` }]));
      return send(200, reply([{ type: "text", text: "Voici nos programmes Omra disponibles." }]));
    }
    const text = lastUserText(data.messages).toLowerCase();
    if (text.includes("panne")) return send(500, { type: "error", error: { type: "api_error", message: "panne simulée" } });
    if (text.includes("reservi")) {
      return send(200, reply([{ type: "tool_use", id: "toolu_1", name: "demander_humain", input: { motif: "intention_achat", resume: "Veut réserver une Omra" } }], "tool_use"));
    }
    if (text.includes("programme")) {
      return send(200, reply([{ type: "tool_use", id: "toolu_2", name: "chercher_programmes", input: { famille: "omra_hajj" } }], "tool_use"));
    }
    return send(200, reply([{ type: "text", text: "Salam ! Je suis l'assistant automatique de l'agence." }]));
  });
});
await new Promise((r) => claude.listen(CLAUDE_PORT, "127.0.0.1", r));

// --- Agence temporaire ----------------------------------------------------------
const SUBDOMAIN = `wa-ai-test-${Date.now() % 100000}`;
const AGENCY = (await q("INSERT INTO agencies (name, subdomain) VALUES (?, ?)", ["Agence IA test", SUBDOMAIN])).insertId;
for (const roleName of ["direction", "ventes", "comptabilite", "suivi"]) {
  await q("INSERT INTO roles (name, description, agency_id) VALUES (?, ?, ?)", [roleName, roleName, AGENCY]);
}
const [ventesRole] = await q("SELECT id FROM roles WHERE agency_id = ? AND name = 'ventes'", [AGENCY]);
const STAFF = (await q("INSERT INTO staff_users (full_name, email, password_hash, role_id, agency_id) VALUES (?, ?, 'x', ?, ?)", ["Conseiller Test", `ventes-${SUBDOMAIN}@test.local`, ventesRole.id, AGENCY])).insertId;
await q(
  `INSERT INTO sla_rules (agency_id, reason, label, team, minutes, priority, around_the_clock)
   SELECT ?, reason, label, team, minutes, priority, around_the_clock FROM sla_rules WHERE agency_id = 1`,
  [AGENCY]
);
// Ouvert 24h/24 pour un test déterministe.
for (let d = 0; d < 7; d += 1) await q("INSERT INTO business_hours (agency_id, weekday, open_time, close_time) VALUES (?, ?, '00:00:00', '23:59:59')", [AGENCY, d]);

const PHONE_NUMBER_ID = String(910000000000 + Math.floor(Math.random() * 99999999));
const APP_SECRET = crypto.randomBytes(16).toString("hex");
setScriptAgencyId(AGENCY);
await saveAccount({ phoneNumberId: PHONE_NUMBER_ID, status: "actif", accessToken: "tok", appSecret: APP_SECRET });
const base = await getActiveSettings(AGENCY);
await saveSettingsVersion({ ...base, systemPrompt: base.system_prompt, mode: "ia", toolsEnabled: base.tools_enabled, transferKeywords: base.transfer_keywords }, null, AGENCY);

const worker = spawn(process.execPath, ["--env-file=.env", "--import", "./scripts/esm-register.mjs", "worker/index.mjs"], {
  env: {
    ...process.env,
    META_GRAPH_BASE_URL: `http://127.0.0.1:${META_PORT}`,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${CLAUDE_PORT}`,
    ANTHROPIC_API_KEY: "test-key",
    WA_ECHO_TEST: "0",
    WA_WORKER_AGENCY_IDS: String(AGENCY),
    WA_AI_DEBOUNCE_MS: "1500",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let workerLog = "";
worker.stdout.on("data", (d) => (workerLog += d));
worker.stderr.on("data", (d) => (workerLog += d));

let seq = 0;
function webhook(waId, message) {
  seq += 1;
  const ts = Math.floor(Date.now() / 1000);
  const payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "212600000000", phone_number_id: PHONE_NUMBER_ID },
      contacts: [{ profile: { name: `Client ${waId.slice(-2)}` }, wa_id: waId }],
      messages: [{ from: waId, id: `wamid.ai.${seq}.${ts}`, timestamp: String(ts), type: "text", text: { body: message } }],
    } }] }],
  };
  const body = JSON.stringify(payload);
  return fetch(`${BASE_URL}/api/webhooks/meta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signMetaPayload(body, APP_SECRET) },
    body,
  });
}
const convOf = async (waId) =>
  (await q(`SELECT c.* FROM wa_conversations c JOIN wa_contacts ct ON ct.id = c.contact_id WHERE ct.agency_id = ? AND ct.phone = ? ORDER BY c.id DESC LIMIT 1`, [AGENCY, waId]))[0];
const sentTo = (waId) => sent.filter((m) => m.to === waId);

async function cleanup() {
  worker.kill("SIGINT");
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
  meta.close();
  claude.close();
  await pool.end();
}

try {
  // 1. Question sur les programmes → outil chercher_programmes → réponse IA envoyée.
  const A = "212600000101";
  await webhook(A, "Salam, chno kayn f les programmes Omra ?");
  const answerA = await waitFor(() => sentTo(A).find((m) => m.text?.body === "Voici nos programmes Omra disponibles."));
  ok(Boolean(answerA), "réponse de l'agent envoyée au client");
  const firstReq = claudeRequests.find((r) => !String(r.model).includes("haiku"));
  ok(firstReq?.model === "claude-sonnet-5-5" && firstReq.output_config?.effort === "low", "modèle Sonnet 5.5, effort low");
  ok(firstReq?.system?.[0]?.cache_control?.type === "ephemeral" && firstReq.system.length === 2, "prompt système mis en cache (bloc stable + bloc variable)");
  ok(firstReq?.tools?.some((t) => t.name === "chercher_programmes") && firstReq.tools.length === 10, "10 outils déclarés");
  ok(/PREMIER ÉCHANGE/.test(firstReq?.system?.[1]?.text || ""), "premier échange : présentation + mention 09-08 demandée");
  const [logA] = await q(`SELECT * FROM ia_logs WHERE agency_id = ? AND context = 'conversation' ORDER BY id LIMIT 1`, [AGENCY]);
  ok(logA && logA.tool_rounds === 1 && (typeof logA.tools === "string" ? JSON.parse(logA.tools) : logA.tools)[0].name === "chercher_programmes" && Number(logA.cost_usd) > 0, "journal IA : outil, tours, coût");
  const convA = await waitFor(async () => {
    const c = await convOf(A);
    // welcomed et ai_last_handled_message_id sont écrits l'un après l'autre.
    return c?.welcomed && c.ai_last_handled_message_id ? c : null;
  });
  ok(convA?.status === "ia" && convA.ai_last_handled_message_id, "conversation reste à l'IA, message marqué traité");

  // 2. Regroupement : deux messages rapprochés → une seule réponse.
  const B = "212600000102";
  const before = claudeRequests.length;
  await webhook(B, "Salam");
  await sleep(300);
  await webhook(B, "chno kayn ?");
  await waitFor(() => sentTo(B).length >= 1);
  await sleep(3500);
  ok(sentTo(B).length === 1, `messages regroupés : une seule réponse (${sentTo(B).length})`);
  const lastReqB = claudeRequests.slice(before).find((r) => JSON.stringify(r.messages).includes("chno kayn"));
  ok(lastReqB && JSON.stringify(lastReqB.messages).includes("Salam"), "le tour regroupé voit les deux messages");

  // 3. Intention d'achat → transfert à l'équipe ventes.
  const C = "212600000103";
  await webhook(C, "bghit nreservi Omra");
  const convC = await waitFor(async () => {
    const c = await convOf(C);
    return c?.status === "humain" && c.sla_due_at ? c : null;
  });
  ok(convC?.team === "ventes" && convC.transfer_reason === "intention_achat" && convC.sla_due_at, "transfert ventes avec échéance SLA");
  ok(Boolean(await waitFor(() => sentTo(C).find((m) => /D'accord/.test(m.text?.body || "")))), "message de transfert envoyé au client");
  const notes = await waitFor(async () => {
    const n = await q(`SELECT content FROM wa_messages WHERE conversation_id = ? AND is_private_note = TRUE`, [convC.id]);
    return n.length >= 2 ? n : null;
  });
  ok(notes?.some((n) => /Transfert — Intention d'achat/.test(n.content)) && notes.some((n) => /Résumé IA/.test(n.content)), "notes privées : motif + résumé (modèle léger)");
  const [notif] = await q(`SELECT * FROM staff_notifications WHERE agency_id = ? AND kind = 'transfert'`, [AGENCY]);
  ok(notif?.team === "ventes", "notification à l'équipe ventes");

  // 4. Statut humain : plus aucune réponse automatique.
  const callsBefore = claudeRequests.length;
  const sentBefore = sentTo(C).length;
  await webhook(C, "allo ?");
  await sleep(4500);
  ok(claudeRequests.length === callsBefore && sentTo(C).length === sentBefore, "conversation humaine : l'IA ne répond plus (HU-05)");

  // 5. STOP → retrait du consentement marketing.
  const D = "212600000104";
  await webhook(D, "STOP");
  const stopMsg = await waitFor(() => sentTo(D).find((m) => /promotionnels/.test(m.text?.body || "")));
  const [consent] = await q(`SELECT cs.action FROM wa_consents cs JOIN wa_contacts ct ON ct.id = cs.contact_id WHERE ct.phone = ? AND ct.agency_id = ?`, [D, AGENCY]);
  ok(Boolean(stopMsg) && consent?.action === "retrait", "STOP : retrait enregistré et confirmé (WA-10)");

  // 6. Urgence → priorité urgente, notification direction.
  const E = "212600000105";
  await webhook(E, "URGENCE j'ai perdu mon passeport");
  const convE = await waitFor(async () => {
    const c = await convOf(E);
    return c?.status === "humain" ? c : null;
  });
  ok(convE?.priority === "urgente" && convE.transfer_reason === "urgence", "urgence : transfert immédiat, priorité urgente");
  const urg = await waitFor(async () => (await q(`SELECT * FROM staff_notifications WHERE agency_id = ? AND kind = 'urgence' AND team = 'direction'`, [AGENCY]))[0]);
  ok(Boolean(urg), "urgence : direction notifiée (HU-11)");

  // 7. Panne de l'API Claude → message d'attente + transfert, aucun message perdu.
  const F = "212600000106";
  await webhook(F, "panne test");
  const convF = await waitFor(async () => {
    const c = await convOf(F);
    return c?.status === "humain" ? c : null;
  }, 45000);
  ok(convF?.transfer_reason === "echec_ia", "panne Claude : transfert echec_ia (NF-04)");
  ok(sentTo(F).some((m) => /conseiller vous répond/.test(m.text?.body || "")), "panne Claude : message d'attente envoyé");
  const [unanswered] = await q(`SELECT * FROM ia_unanswered WHERE agency_id = ? AND conversation_id = ?`, [AGENCY, convF?.id || 0]);
  ok(Boolean(unanswered), "question ajoutée aux « questions sans réponse »");

  // 8. Mode copilote : brouillon, rien n'est envoyé, puis validation.
  const s = await getActiveSettings(AGENCY);
  await saveSettingsVersion({ ...s, systemPrompt: s.system_prompt, mode: "copilote", toolsEnabled: s.tools_enabled, transferKeywords: s.transfer_keywords }, null, AGENCY);
  const G = "212600000107";
  await webhook(G, "Salam");
  const draft = await waitFor(async () => (await q(`SELECT m.* FROM wa_messages m JOIN wa_conversations c ON c.id = m.conversation_id JOIN wa_contacts ct ON ct.id = c.contact_id WHERE ct.phone = ? AND m.draft_status = 'brouillon'`, [G]))[0]);
  ok(Boolean(draft) && sentTo(G).length === 0, "copilote : brouillon enregistré, rien envoyé (IA-14)");
  const session = { id: STAFF, role: "direction", agencyId: AGENCY, fullName: "Test" };
  await runWithAgency(AGENCY, () => approveDraft(session, draft.conversation_id, draft.id, "Salam, merci pour votre message !"));
  ok(sentTo(G).some((m) => m.text?.body === "Salam, merci pour votre message !"), "brouillon corrigé puis envoyé par le conseiller");

  // 9. Bac à sable : simulation sans envoi.
  const sentCount = sent.length;
  const sandbox = await runWithAgency(AGENCY, () => runSandbox({ history: [{ role: "user", text: "bghit nreservi" }] }));
  ok(sandbox.effects.transfer?.reason === "intention_achat" && sent.length === sentCount, "bac à sable : transfert simulé, aucun envoi");

  // 10. Isolation : l'agence 1 ne voit pas ces conversations.
  const agency1 = await runWithAgency(1, () => listConversations({ id: 0, role: "direction", agencyId: 1 }, { status: "ouvertes" }));
  ok(!agency1.some((c) => [A, B, C, D, E, F, G].includes(c.phone)), "isolation : l'agence 1 ne voit rien de l'agence test");
} catch (err) {
  failures += 1;
  console.error("ERREUR", err);
} finally {
  if (failures) console.log("\n--- journal du worker ---\n" + workerLog.slice(-6000));
  await cleanup();
}
console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrôles passent.");
process.exit(failures ? 1 : 0);
