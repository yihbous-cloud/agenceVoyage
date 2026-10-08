// Worker WhatsApp — processus Node séparé de Next.js (lancé par PM2, voir
// ecosystem.config.cjs ; en local : npm run worker). Exécute les tâches
// déposées dans Redis/BullMQ par le webhook et l'admin (CLAUDE.md
// §3centquadragies et §3centunquadragies) :
//   - wa-inbound  : message reçu → accusé de lecture, médias, transcription,
//                   puis tour de l'agent IA différé (regroupement WA-03) ;
//   - wa-ai       : tour de l'agent IA (lib/whatsapp/aiReply.js) ;
//   - wa-outbound : envois simples (mode écho de recette).
// Tâches périodiques : balayages (messages / tours IA perdus), alertes SLA.
//
// Chaque tâche s'exécute dans le contexte de SON agence (runWithAgency) :
// plusieurs agences peuvent être traitées en parallèle sans se mélanger.
//
// Lancement : node --env-file=.env --import ./scripts/esm-register.mjs worker/index.mjs
import { Worker } from "bullmq";
import { QUEUES, redisConnectionOptions, getQueue, enqueue, inboundJobId, aiJobId, getRedis, HEARTBEAT_KEY } from "../lib/queue.js";
import {
  claimInboundMessage,
  finishInboundMessage,
  downloadMessageMedia,
  markInboundRead,
  transcribeMessageAudio,
  loadMessageMediaForAgent,
  sendConversationText,
  listStaleInboundMessages,
} from "../lib/whatsapp/processing.js";
import { getAccountCredentials } from "../lib/whatsapp/accounts.js";
import { handleAiTurn, setMediaLoader, RetryLaterError, AI_DEBOUNCE_MS, listStaleAiTurns } from "../lib/whatsapp/aiReply.js";
import { checkSlaBreaches } from "../lib/whatsapp/handoff.js";
import { runWithAgency } from "../lib/agencyContext.js";
import { runTestSuite } from "../lib/ai/sandbox.js";
import { handleCrmEvent, planScheduledTriggers, executeRun, listDueRuns, listAgenciesWithActiveTriggers } from "../lib/whatsapp/triggers.js";
import { syncTemplates } from "../lib/whatsapp/templates.js";
import { runCampaignStep, listActiveCampaigns } from "../lib/whatsapp/campaigns.js";
import { deliverDailyReport, listAgenciesDueForReport } from "../lib/whatsapp/reports.js";
import { purgeAgencyData } from "../lib/whatsapp/privacy.js";
import { ensureWeeklyAudit } from "../lib/whatsapp/journal.js";
import { localParts } from "../lib/whatsapp/team.js";
import { recordJob } from "../lib/systemJobs.js";
import { query } from "../lib/db.js";

const SWEEP_INTERVAL_MS = 30_000;
const DUE_RUNS_INTERVAL_MS = 60_000; // exécutions de déclencheurs arrivées à échéance
const PLAN_INTERVAL_MS = 15 * 60_000; // dates relatives, inactivité, rapport 19h (DC-07)
const TEMPLATE_SYNC_INTERVAL_MS = 60 * 60_000; // statuts des templates Meta (TP-02)
const SLA_INTERVAL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const CAMPAIGN_INTERVAL_MS = Number(process.env.WA_CAMPAIGN_INTERVAL_MS) || 60_000; // un lot par campagne active et par minute
const REPORT_INTERVAL_MS = 5 * 60_000; // rapport quotidien (heure paramétrable, 19h par défaut)
const MAINTENANCE_INTERVAL_MS = 30 * 60_000; // purge CNDP (nuit), audit IA hebdomadaire (lundi)

function log(...args) {
  console.log(new Date().toISOString(), "[worker]", ...args);
}

setMediaLoader(loadMessageMediaForAgent);

// Périmètre d'agences (WA_WORKER_AGENCY_IDS="12,15") : vide = toutes.
// Utilisé par les scripts de recette, qui lancent un worker pointé sur de
// FAUX serveurs Meta/Claude : il ne doit jamais traiter les messages d'une
// autre agence. Une tâche hors périmètre est ignorée sans être consommée
// (le message reste « reçu » et sera repris par le worker normal).
const AGENCY_SCOPE = new Set(
  String(process.env.WA_WORKER_AGENCY_IDS || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Boolean)
);
const inScope = (agencyId) => AGENCY_SCOPE.size === 0 || AGENCY_SCOPE.has(Number(agencyId));
const OUT_OF_SCOPE = { skipped: "agence hors périmètre de ce worker" };

// Mode écho (recette Lot 0) : compte au statut "test" ET WA_ECHO_TEST=1 →
// chaque texte reçu est renvoyé tel quel, À LA PLACE de l'agent IA.
function echoEnabled(creds) {
  return process.env.WA_ECHO_TEST === "1" && creds?.status === "test";
}

async function scheduleAiTurn(agencyId, conversationId, messageId) {
  return enqueue(QUEUES.ai, "turn", { agencyId, conversationId, messageId }, {
    jobId: aiJobId(messageId),
    delay: AI_DEBOUNCE_MS,
    // Tour reporté si un autre tour est en cours ou si un média se télécharge.
    attempts: 6,
    backoff: { type: "fixed", delay: 4000 },
  });
}

async function handleInbound(job) {
  const { agencyId, messageId } = job.data;
  if (!inScope(agencyId)) return OUT_OF_SCOPE;
  return runWithAgency(agencyId, async () => {
    const message = await claimInboundMessage(agencyId, messageId);
    if (!message) return { skipped: true };
    try {
      const creds = await getAccountCredentials(agencyId);
      if (!creds?.accessToken) throw new Error("Jeton WhatsApp non configuré pour cette agence");

      await markInboundRead(agencyId, message.meta_message_id).catch((err) =>
        log(`accusé de lecture impossible (message ${messageId}) : ${err.message}`)
      );
      const mediaCount = await downloadMessageMedia(agencyId, messageId, creds.accessToken);
      if (message.type === "audio") {
        await transcribeMessageAudio(agencyId, messageId).catch((err) => log(`transcription impossible (message ${messageId}) : ${err.message}`));
      }
      await finishInboundMessage(agencyId, messageId);

      if (echoEnabled(creds)) {
        if (message.type === "text" && message.content) {
          await enqueue(QUEUES.outbound, "text", {
            agencyId,
            conversationId: message.conversation_id,
            text: `Écho : ${message.content}`,
            replyToMetaId: message.meta_message_id,
          });
        }
      } else {
        await scheduleAiTurn(agencyId, message.conversation_id, messageId);
      }
      return { mediaCount };
    } catch (err) {
      await finishInboundMessage(agencyId, messageId, { error: err.message });
      throw err; // BullMQ relance (3 tentatives, délai exponentiel)
    }
  });
}

async function handleAi(job) {
  const { agencyId, conversationId, messageId } = job.data;
  if (!inScope(agencyId)) return OUT_OF_SCOPE;
  // Jeu de tests du bac à sable (NF-15), lancé depuis l'admin.
  if (job.name === "test-suite") {
    return runWithAgency(agencyId, () => runTestSuite(job.data.runKey, agencyId));
  }
  return runWithAgency(agencyId, async () => {
    try {
      return await handleAiTurn(agencyId, conversationId, messageId);
    } catch (err) {
      if (err instanceof RetryLaterError) log(`tour IA reporté (conversation ${conversationId}) : ${err.message}`);
      throw err;
    }
  });
}

async function handleOutbound(job) {
  const { agencyId, conversationId, text, replyToMetaId, author, staffId } = job.data;
  if (!inScope(agencyId)) return OUT_OF_SCOPE;
  return runWithAgency(agencyId, () =>
    sendConversationText(agencyId, conversationId, text, {
      author: author || "systeme",
      staffId: staffId || null,
      replyToMetaId: replyToMetaId || null,
    })
  );
}

async function requeue(queueName, jobId, jobName, data, opts = {}) {
  const queue = getQueue(queueName);
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "completed" && state !== "failed") return; // déjà en file
    await existing.remove();
  }
  await enqueue(queueName, jobName, data, { jobId, ...opts });
}

// Reprise des messages jamais signalés à la file (Redis arrêté pendant le
// webhook) et des tours IA perdus (worker arrêté pendant le délai de
// regroupement) — la base reste la source de vérité.
async function sweep() {
  try {
    const stale = (await listStaleInboundMessages()).filter((r) => inScope(r.agency_id));
    for (const row of stale) {
      await requeue(QUEUES.inbound, inboundJobId(row.id), "message", { agencyId: row.agency_id, messageId: row.id });
    }
    const turns = (await listStaleAiTurns()).filter((t) => inScope(t.agency_id));
    for (const t of turns) {
      await requeue(QUEUES.ai, aiJobId(t.message_id), "turn", { agencyId: t.agency_id, conversationId: t.conversation_id, messageId: t.message_id });
    }
    if (stale.length || turns.length) log(`balayage : ${stale.length} message(s), ${turns.length} tour(s) IA repris`);
  } catch (err) {
    log(`balayage en échec : ${err.message}`);
  }
}

async function slaTick() {
  try {
    const n = await checkSlaBreaches(AGENCY_SCOPE.size ? [...AGENCY_SCOPE] : null);
    if (n) log(`SLA : ${n} alerte(s) envoyée(s)`);
  } catch (err) {
    log(`contrôle SLA en échec : ${err.message}`);
  }
}

// Événement CRM (lib/events.js) → planification des déclencheurs concernés.
async function handleTriggerEvent(job) {
  const { agencyId } = job.data;
  if (!inScope(agencyId)) return OUT_OF_SCOPE;
  return runWithAgency(agencyId, () => handleCrmEvent(agencyId, job.data));
}

async function dueRunsTick() {
  try {
    const due = (await listDueRuns()).filter((r) => inScope(r.agency_id));
    for (const run of due) {
      await runWithAgency(run.agency_id, () => executeRun(run.agency_id, run.id)).catch((err) =>
        log(`déclencheur : exécution ${run.id} en échec — ${err.message}`)
      );
    }
    if (due.length) log(`déclencheurs : ${due.length} exécution(s) traitée(s)`);
  } catch (err) {
    log(`déclencheurs en échec : ${err.message}`);
  }
}

async function planTick() {
  try {
    const agencies = (await listAgenciesWithActiveTriggers()).filter((a) => inScope(a.agency_id));
    let planned = 0;
    for (const { agency_id: agencyId } of agencies) {
      planned += await runWithAgency(agencyId, () => planScheduledTriggers(agencyId));
    }
    if (planned) log(`déclencheurs : ${planned} envoi(s) planifié(s)`);
  } catch (err) {
    log(`planification en échec : ${err.message}`);
  }
}

async function templateSyncTick() {
  try {
    const accounts = await query(
      `SELECT agency_id FROM wa_accounts WHERE waba_id IS NOT NULL AND status <> 'inactif' -- agency-lint-ok: synchronisation de toutes les agences`
    );
    for (const { agency_id: agencyId } of accounts.filter((a) => inScope(a.agency_id))) {
      await runWithAgency(agencyId, () => syncTemplates(agencyId)).catch((err) => log(`synchronisation des templates (agence ${agencyId}) : ${err.message}`));
    }
  } catch (err) {
    log(`synchronisation des templates en échec : ${err.message}`);
  }
}

// Campagnes (CP-05) : un lot par campagne et par minute, sur leur propre
// file à concurrence 1 — les réponses aux clients (wa-inbound/wa-ai) ne
// sont jamais retardées par un envoi de masse (NF-03).
async function handleCampaign(job) {
  const { agencyId, campaignId } = job.data;
  if (!inScope(agencyId)) return OUT_OF_SCOPE;
  return runWithAgency(agencyId, () => runCampaignStep(agencyId, campaignId));
}

async function campaignTick() {
  try {
    const active = (await listActiveCampaigns()).filter((c) => inScope(c.agency_id));
    const slot = Math.floor(Date.now() / CAMPAIGN_INTERVAL_MS);
    for (const c of active) {
      await enqueue(QUEUES.campaigns, "step", { agencyId: c.agency_id, campaignId: c.id }, { jobId: `cp-${c.id}-${slot}`, attempts: 1 });
    }
  } catch (err) {
    log(`campagnes en échec : ${err.message}`);
  }
}

async function reportTick() {
  try {
    const due = (await listAgenciesDueForReport()).filter(inScope);
    for (const agencyId of due) {
      const r = await runWithAgency(agencyId, () => deliverDailyReport(agencyId)).catch((err) => log(`rapport (agence ${agencyId}) : ${err.message}`));
      if (r?.report) log(`rapport quotidien envoyé (agence ${agencyId})${r.mail?.sent ? " + e-mail" : ""}`);
    }
  } catch (err) {
    log(`rapport quotidien en échec : ${err.message}`);
  }
}

// Purge CNDP entre 2h et 4h du matin (heure du Maroc) ; audit qualité IA
// hebdomadaire créé le lundi.
async function maintenanceTick() {
  const { minutes, weekday } = localParts();
  try {
    const agencies = (await query(`SELECT agency_id FROM wa_accounts -- agency-lint-ok: maintenance de toutes les agences`)).map((r) => r.agency_id).filter(inScope);
    if (minutes >= 120 && minutes < 240) {
      const rows = await query(`SELECT agency_id FROM wa_ops_settings WHERE purge_enabled = TRUE AND (last_purge_at IS NULL OR last_purge_at < UTC_TIMESTAMP() - INTERVAL 20 HOUR) -- agency-lint-ok: purge de toutes les agences`);
      const results = [];
      for (const { agency_id: agencyId } of rows.filter((r) => inScope(r.agency_id))) {
        const r = await runWithAgency(agencyId, () => purgeAgencyData(agencyId));
        results.push(`agence ${agencyId} : ${r.result}`);
      }
      if (rows.length) await recordJob("purge", "ok", results.join(" | ").slice(0, 500));
    }
    if (weekday === 1) {
      for (const agencyId of agencies) await runWithAgency(agencyId, () => ensureWeeklyAudit(agencyId)).catch((err) => log(`audit IA (agence ${agencyId}) : ${err.message}`));
    }
  } catch (err) {
    log(`maintenance en échec : ${err.message}`);
    await recordJob("purge", "erreur", err.message).catch(() => {});
  }
}

const workers = [
  ["inbound", new Worker(QUEUES.inbound, handleInbound, { connection: redisConnectionOptions(), concurrency: 5 })],
  // Les tours IA (appels Claude, plusieurs secondes) ont leur propre file.
  ["ai", new Worker(QUEUES.ai, handleAi, { connection: redisConnectionOptions(), concurrency: 4 })],
  ["triggers", new Worker(QUEUES.triggers, handleTriggerEvent, { connection: redisConnectionOptions(), concurrency: 3 })],
  [
    "campaigns",
    new Worker(QUEUES.campaigns, handleCampaign, { connection: redisConnectionOptions(), concurrency: 1, limiter: { max: 1, duration: 1000 } }),
  ],
  [
    "outbound",
    new Worker(QUEUES.outbound, handleOutbound, {
      connection: redisConnectionOptions(),
      concurrency: 5,
      limiter: { max: 20, duration: 1000 },
    }),
  ],
];
for (const [name, w] of workers) {
  w.on("failed", (job, err) => log(`${name} : tâche ${job?.id} en échec (tentative ${job?.attemptsMade}) — ${err.message}`));
  w.on("error", (err) => log(`${name} : ${err.message}`));
}

const beat = () => getRedis().set(HEARTBEAT_KEY, String(Date.now()), "EX", 120);
const timers = [
  setInterval(() => beat().catch((err) => log(`battement impossible : ${err.message}`)), HEARTBEAT_INTERVAL_MS),
  setInterval(sweep, SWEEP_INTERVAL_MS),
  setInterval(slaTick, SLA_INTERVAL_MS),
  setInterval(dueRunsTick, DUE_RUNS_INTERVAL_MS),
  setInterval(planTick, PLAN_INTERVAL_MS),
  setInterval(templateSyncTick, TEMPLATE_SYNC_INTERVAL_MS),
  setInterval(campaignTick, CAMPAIGN_INTERVAL_MS),
  setInterval(reportTick, REPORT_INTERVAL_MS),
  setInterval(maintenanceTick, MAINTENANCE_INTERVAL_MS),
];
beat().catch(() => {});
sweep();
slaTick();
planTick().then(dueRunsTick);
campaignTick();
reportTick();
maintenanceTick();
log("démarré — files :", Object.values(QUEUES).join(", "));

async function shutdown(signal) {
  log(`arrêt (${signal})...`);
  timers.forEach(clearInterval);
  await Promise.allSettled(workers.map(([, w]) => w.close()));
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
