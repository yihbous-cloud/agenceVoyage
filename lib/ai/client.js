import Anthropic from "@anthropic-ai/sdk";
import { query } from "../db";
import { DEFAULT_PRICES } from "./settings";

// Client Anthropic (SDK officiel @anthropic-ai/sdk). Clé : ANTHROPIC_API_KEY
// (variable d'environnement du serveur, jamais en base ni côté navigateur).
// maxRetries: 3 = nouvelles tentatives automatiques sur surcharge (529),
// limite de débit (429), erreurs 5xx et coupures réseau (exigence CL-07).
// ANTHROPIC_BASE_URL (lu par le SDK) sert aux tests automatisés (faux serveur).

let client;

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getAnthropic() {
  if (!client) {
    client = new Anthropic({ maxRetries: 3, timeout: 60_000 });
  }
  return client;
}

// Coût estimé d'un appel (tokens × tarif paramétré, exigence CL-08 / 8.3).
export function estimateCost(model, usage, prices = DEFAULT_PRICES) {
  const p = prices[model] || DEFAULT_PRICES[model];
  if (!p || !usage) return 0;
  const m = 1_000_000;
  return (
    ((usage.input_tokens || 0) * p.input) / m +
    ((usage.output_tokens || 0) * p.output) / m +
    ((usage.cache_read_input_tokens || 0) * (p.cache_read ?? p.input * 0.1)) / m +
    ((usage.cache_creation_input_tokens || 0) * (p.cache_write ?? p.input * 1.25)) / m
  );
}

// Dépense IA du mois en cours (plafond mensuel, CL-09).
export async function monthToDateCost(agencyId) {
  const rows = await query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ia_logs
     WHERE agency_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    [agencyId]
  );
  return Number(rows[0]?.total || 0);
}

export async function insertIaLog(agencyId, data) {
  const result = await query(
    `INSERT INTO ia_logs (agency_id, conversation_id, context, model, settings_version, input_tokens, output_tokens,
       cache_read_tokens, cache_write_tokens, tool_rounds, tools, duration_ms, cost_usd, outcome, stop_reason, response, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agencyId,
      data.conversationId || null,
      data.context || "conversation",
      data.model,
      data.settingsVersion || null,
      data.usage?.input_tokens || 0,
      data.usage?.output_tokens || 0,
      data.usage?.cache_read_input_tokens || 0,
      data.usage?.cache_creation_input_tokens || 0,
      data.toolRounds || 0,
      data.tools ? JSON.stringify(data.tools) : null,
      data.durationMs || null,
      data.cost || 0,
      data.outcome || "reponse",
      data.stopReason || null,
      data.response || null,
      data.error ? String(data.error).slice(0, 500) : null,
    ]
  );
  return result.insertId;
}
