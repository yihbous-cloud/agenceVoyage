import { Queue } from "bullmq";
import IORedis from "ioredis";

// Files d'attente (BullMQ + Redis, CLAUDE.md §3centquadragies). Le webhook
// Meta et l'admin y DÉPOSENT des tâches ; seul le worker (worker/index.mjs,
// processus séparé lancé par PM2) les exécute.
//
// Principe "aucun message perdu" (NF-04) : la base MySQL reste la source de
// vérité. Un message entrant est d'abord enregistré (processing_status =
// "recu"), puis seulement signalé à la file ; si Redis est indisponible, le
// dépôt échoue SANS faire échouer le webhook, et le balayage périodique du
// worker reprend tout message resté "recu".

export const QUEUES = {
  inbound: "wa-inbound", // messages reçus — prioritaire
  outbound: "wa-outbound", // envois vers WhatsApp
  ai: "wa-ai", // tours de l'agent IA (appels Claude)
  triggers: "wa-triggers", // événements CRM et déclencheurs automatiques
  campaigns: "wa-campaigns", // campagnes marketing — file séparée, débit limité (NF-03)
};

export function redisConnectionOptions(extra = {}) {
  return {
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    maxRetriesPerRequest: null,
    ...extra,
  };
}

// Côté producteur (Next.js) : jamais d'attente bloquante si Redis est
// injoignable. maxRetriesPerRequest: 1 = une commande en attente est
// abandonnée après une tentative de reconnexion (pas d'accumulation infinie
// en mémoire), et enqueue() borne de toute façon l'attente.
// ⚠️ Ne pas utiliser enableOfflineQueue: false : BullMQ envoie une commande
// INFO avant que la connexion soit prête, ce qui fait alors échouer TOUTE
// initialisation de la file (constaté en test).
const producers = globalThis.__gfQueuesV2 || (globalThis.__gfQueuesV2 = new Map());

export function getQueue(name) {
  if (!producers.has(name)) {
    const queue = new Queue(name, {
      connection: redisConnectionOptions({ maxRetriesPerRequest: 1, connectTimeout: 2000 }),
      skipWaitingForReady: true,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    queue.on("error", (err) => {
      // Évite le bruit d'une erreur non gérée quand Redis est arrêté : le
      // balayage du worker prendra le relais.
      if (!queue.__gfWarned) {
        console.warn(`[queue] ${name} : Redis indisponible (${err.message})`);
        queue.__gfWarned = true;
      }
    });
    producers.set(name, queue);
  }
  return producers.get(name);
}

// Dépose une tâche ; ne lève jamais d'erreur (retourne false si Redis ne
// répond pas dans le délai). `jobId` déduplique : une même tâche déposée deux
// fois (webhook + balayage) n'est exécutée qu'une fois.
export async function enqueue(queueName, jobName, data, opts = {}, timeoutMs = 1500) {
  try {
    await Promise.race([
      getQueue(queueName).add(jobName, data, opts),
      new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), timeoutMs)),
    ]);
    return true;
  } catch (err) {
    console.warn(`[queue] dépôt impossible dans ${queueName} : ${err.message}`);
    return false;
  }
}

// Petit client Redis partagé (battement de cœur du worker, plus tard
// publication temps réel pour l'inbox). Même politique que les producteurs.
export const HEARTBEAT_KEY = "gf:worker:heartbeat";
export function getRedis() {
  if (!globalThis.__gfRedis) {
    const { url } = redisConnectionOptions();
    globalThis.__gfRedis = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: false });
    globalThis.__gfRedis.on("error", () => {}); // signalé par getQueueHealth()
  }
  return globalThis.__gfRedis;
}

export function inboundJobId(messageId) {
  return `in-${messageId}`;
}

export function aiJobId(messageId) {
  return `ai-${messageId}`;
}

// État des files pour l'admin (tableau "état des services").
export async function getQueueHealth() {
  try {
    const queue = getQueue(QUEUES.inbound);
    const [counts, heartbeat] = await Promise.race([
      Promise.all([
        queue.getJobCounts("waiting", "active", "delayed", "failed"),
        getRedis().get(HEARTBEAT_KEY),
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), 1500)),
    ]);
    const workerHeartbeatAge = heartbeat ? Math.round((Date.now() - Number(heartbeat)) / 1000) : null;
    return { redis: true, counts, workerHeartbeatAge };
  } catch (err) {
    return { redis: false, error: err.message, counts: null, workerHeartbeatAge: null };
  }
}
