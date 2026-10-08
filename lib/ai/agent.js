import Anthropic from "@anthropic-ai/sdk";
import { query } from "../db";
import { getAnthropic, estimateCost, insertIaLog } from "./client";
import { toolDefinitionsFor, executeTool } from "./tools";
import { redactDeep, redactText } from "./redact";

// Boucle de l'agent IA (exigences CL-01 à CL-08) : appel direct de l'API
// Claude par le SDK officiel, boucle d'outils manuelle (contrôle du nombre de
// tours, journalisation de chaque outil, effets différés — voir tools.js).
//
// Cache du prompt (CL-06) : outils (ordre fixe) puis bloc système STABLE
// (prompt + base de connaissances) marqué cache_control ; tout ce qui varie
// (date, horaires, fiche CRM du contact) va dans un second bloc système APRÈS
// le point de cache, pour ne jamais invalider le préfixe mis en cache.

export const MAX_TOOL_ROUNDS = 5; // CL-04 : au-delà, transfert humain

// Repli serveur en cas de refus des classifieurs de sécurité : uniquement sur
// les modèles qui l'acceptent (Claude API) — voir skill claude-api.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export async function loadKnowledgeBlock(agencyId) {
  const rows = await query(
    `SELECT category, question, variants, answer_fr, answer_ar FROM ia_knowledge
     WHERE agency_id = ? AND status = 'publie' ORDER BY category, id`,
    [agencyId]
  );
  if (rows.length === 0) return "";
  const lines = rows.map((r) => {
    const parts = [`[${r.category}] Q : ${r.question}`];
    if (r.variants) parts.push(`  Formulations : ${String(r.variants).replace(/\s*\n\s*/g, " | ")}`);
    if (r.answer_fr) parts.push(`  R (fr) : ${r.answer_fr}`);
    if (r.answer_ar) parts.push(`  R (ar) : ${r.answer_ar}`);
    return parts.join("\n");
  });
  return `\n\n# Base de connaissances validée par l'agence\nUtilise ces réponses (en les reformulant dans la langue du client). Elles ne contiennent ni prix ni dates : ceux-ci viennent uniquement des outils.\n\n${lines.join("\n\n")}`;
}

function textOf(content) {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function addUsage(total, usage) {
  if (!usage) return total;
  for (const key of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
    total[key] = (total[key] || 0) + (usage[key] || 0);
  }
  return total;
}

function describeError(err) {
  if (err instanceof Anthropic.RateLimitError) return "limite de débit (429)";
  if (err instanceof Anthropic.AuthenticationError) return "clé API Anthropic invalide";
  if (err instanceof Anthropic.BadRequestError) return `requête refusée : ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "connexion à l'API Claude impossible";
  if (err instanceof Anthropic.APIError) return `API Claude ${err.status} : ${err.message}`;
  return err?.message || String(err);
}

// Exécute un tour complet de l'agent.
//   messages      : historique au format Messages API (commence par "user")
//   stablePrompt  : prompt système + base de connaissances (mis en cache)
//   dynamicContext: contexte variable (date, horaires, fiche CRM)
//   ctx           : contexte des outils (agence, contact, effets...)
export async function runAgent({ settings, messages, stablePrompt, dynamicContext, ctx, log = {} }) {
  const started = Date.now();
  const client = getAnthropic();
  const model = settings.model_conversation;
  const tools = toolDefinitionsFor(settings.tools_enabled);
  const conversation = [...messages];
  const usage = {};
  const toolCalls = [];
  let rounds = 0;
  let final = null;
  let outcome = "reponse";
  let error = null;

  const request = {
    model,
    max_tokens: settings.max_tokens,
    output_config: { effort: settings.effort },
    system: [
      { type: "text", text: stablePrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: dynamicContext },
    ],
    tools,
  };
  const useFallback = FALLBACK_MODELS.has(model) && !process.env.ANTHROPIC_BASE_URL;

  try {
    for (;;) {
      const params = { ...request, messages: conversation };
      const response = useFallback
        ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
        : await client.messages.create(params);
      addUsage(usage, response.usage);
      final = response;

      if (response.stop_reason === "refusal") {
        outcome = "refus";
        break;
      }
      if (response.stop_reason !== "tool_use") break;

      rounds += 1;
      if (rounds > MAX_TOOL_ROUNDS) {
        outcome = "limite_outils";
        break;
      }
      // Le tour de l'assistant est renvoyé TEL QUEL (blocs de réflexion compris).
      conversation.push({ role: "assistant", content: response.content });
      const results = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const t0 = Date.now();
        let result;
        let isError = false;
        try {
          result = await executeTool(block.name, block.input, ctx);
        } catch (err) {
          isError = true;
          result = { erreur: `Échec de l'outil : ${err.message}` };
        }
        if (result?.erreur) isError = true;
        const serialized = JSON.stringify(result);
        toolCalls.push({
          name: block.name,
          input: redactDeep(block.input),
          result: redactText(serialized).slice(0, 2000),
          ms: Date.now() - t0,
          error: isError,
        });
        results.push({ type: "tool_result", tool_use_id: block.id, content: serialized, ...(isError ? { is_error: true } : {}) });
      }
      // Tous les résultats dans UN seul message utilisateur.
      conversation.push({ role: "user", content: results });
    }
  } catch (err) {
    outcome = "erreur";
    error = describeError(err);
  }

  const text = final && outcome !== "erreur" && outcome !== "refus" ? textOf(final.content) : "";
  if (outcome === "reponse" && !text && !ctx.effects.transfer && ctx.effects.outbound.length === 0) {
    outcome = "vide";
  }
  const cost = estimateCost(model, usage, settings.prices);
  const logId = await insertIaLog(ctx.agencyId, {
    conversationId: log.conversationId || null,
    context: log.context || "conversation",
    model: final?.model || model,
    settingsVersion: settings.version,
    usage,
    toolRounds: rounds,
    tools: toolCalls,
    durationMs: Date.now() - started,
    cost,
    outcome,
    stopReason: final?.stop_reason || null,
    response: redactText(text) || null,
    error,
  });

  return { text, outcome, error, toolCalls, usage, cost, logId, rounds, model: final?.model || model };
}

// Appel simple au modèle léger (résumé de transfert, HU-02).
export async function runSimple({ settings, agencyId, system, prompt, conversationId = null, maxTokens = 600 }) {
  const started = Date.now();
  const model = settings.model_summary;
  try {
    const response = await getAnthropic().messages.create({
      model,
      max_tokens: maxTokens,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.stop_reason === "refusal" ? "" : textOf(response.content);
    const cost = estimateCost(model, response.usage, settings.prices);
    await insertIaLog(agencyId, {
      conversationId,
      context: "resume",
      model: response.model || model,
      settingsVersion: settings.version,
      usage: response.usage,
      durationMs: Date.now() - started,
      cost,
      outcome: text ? "reponse" : "vide",
      stopReason: response.stop_reason,
      response: redactText(text),
    });
    return text;
  } catch (err) {
    await insertIaLog(agencyId, {
      conversationId,
      context: "resume",
      model,
      settingsVersion: settings.version,
      durationMs: Date.now() - started,
      outcome: "erreur",
      error: describeError(err),
    });
    return "";
  }
}
