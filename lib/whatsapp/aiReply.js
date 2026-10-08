import { query } from "../db";
import { getActiveSettings, pickMessage } from "../ai/settings";
import { runAgent } from "../ai/agent";
import { buildStablePrompt, buildDynamicContext, historyToMessages } from "../ai/context";
import { isAiConfigured, monthToDateCost } from "../ai/client";
import { sendConversationText, sendConversationImage, sendConversationInteractive, saveDraft } from "./outbound";
import { transferConversation, transferMessageFor, findAdvisor } from "./handoff";
import { getBusinessHours, isOpenAt, nextOpeningLabel, computeSlaDue, getSlaRule, notify, createTask } from "./team";

// Un "tour" de l'agent IA pour une conversation (exécuté par le worker).
// Déclenché après chaque message entrant, avec un délai de regroupement
// (WA-03) : si un message plus récent arrive entre-temps, ce tour s'efface
// au profit du suivant, qui répondra à TOUS les messages non traités.
//
// Ordre des contrôles (le premier qui s'applique termine le tour) :
//   contact bloqué → STOP (désinscription marketing, WA-10) → mot-clé
//   d'urgence (HU-11) → conversation déjà chez un humain (HU-05) → client
//   avec conseiller attitré (6.1) → agent désactivé → plafond de coût
//   (CL-09) → vocal non transcrit → agent IA (réponse ou brouillon copilote).

export const AI_DEBOUNCE_MS = Number(process.env.WA_AI_DEBOUNCE_MS || 7000);

const STOP_WORDS = new Set(["stop", "arret", "arreter", "desabonner", "desinscrire", "unsubscribe", "ستوب", "توقف", "الغاء"]);
const toSql = (d) => (d ? d.toISOString().slice(0, 19).replace("T", " ") : null);

export function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsKeyword(text, keyword) {
  const t = ` ${normalizeText(text)} `;
  const k = normalizeText(keyword);
  return k && t.includes(` ${k} `);
}

// Langue de réponse pour les messages système (repli si l'agent ne l'a pas
// encore enregistrée) : écriture arabe → arabe, sinon français.
function guessLanguage(contact, texts) {
  if (contact.language) return contact.language;
  return texts.some((t) => /[؀-ۿ]/.test(t || "")) ? "ar" : "fr";
}

async function acquireLock(agencyId, conversationId) {
  const result = await query(
    `UPDATE wa_conversations SET ai_lock_until = UTC_TIMESTAMP() + INTERVAL 3 MINUTE
     WHERE id = ? AND agency_id = ? AND (ai_lock_until IS NULL OR ai_lock_until < UTC_TIMESTAMP())`,
    [conversationId, agencyId]
  );
  return result.affectedRows === 1;
}

async function releaseLock(agencyId, conversationId, handledUpTo) {
  await query(
    `UPDATE wa_conversations SET ai_lock_until = NULL,
       ai_last_handled_message_id = GREATEST(COALESCE(ai_last_handled_message_id, 0), ?)
     WHERE id = ? AND agency_id = ?`,
    [handledUpTo || 0, conversationId, agencyId]
  );
}

async function safeSend(agencyId, conversationId, text, opts) {
  if (!text) return null;
  try {
    return await sendConversationText(agencyId, conversationId, text, opts);
  } catch (err) {
    console.warn(`[ai] envoi impossible (conversation ${conversationId}) : ${err.message}`);
    return null;
  }
}

export class RetryLaterError extends Error {}

export async function handleAiTurn(agencyId, conversationId, triggerMessageId) {
  const [conv] = await query(
    `SELECT c.*, ct.id AS contact_id, ct.phone, ct.profile_name, ct.language, ct.stage, ct.qualification, ct.traveler_id,
       ct.advisor_staff_id, ct.blocked, ct.marketing_opt_in
     FROM wa_conversations c JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE c.id = ? AND c.agency_id = ?`,
    [conversationId, agencyId]
  );
  if (!conv) return { skipped: "conversation introuvable" };

  // Regroupement : un message plus récent prendra le relais.
  const [newer] = await query(
    `SELECT id FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND direction = 'entrant' AND id > ?
       AND processing_status <> 'ignore' LIMIT 1`,
    [conversationId, agencyId, triggerMessageId]
  );
  if (newer) return { skipped: "message plus récent en attente" };

  if (!(await acquireLock(agencyId, conversationId))) throw new RetryLaterError("Tour IA déjà en cours pour cette conversation");

  const lastHandled = Number(conv.ai_last_handled_message_id || 0);
  let handledUpTo = lastHandled;
  try {
    const pending = await query(
      `SELECT * FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND direction = 'entrant' AND id > ?
       ORDER BY id ASC`,
      [conversationId, agencyId, lastHandled]
    );
    if (pending.some((m) => m.processing_status === "recu" || m.processing_status === "en_cours")) {
      throw new RetryLaterError("Messages encore en cours de traitement (médias)");
    }
    const fresh = pending.filter((m) => m.processing_status !== "ignore");
    handledUpTo = pending.length ? pending[pending.length - 1].id : lastHandled;
    if (fresh.length === 0) return { skipped: "rien de nouveau" };
    if (conv.blocked) return { skipped: "contact bloqué" };

    const settings = await getActiveSettings(agencyId);
    const texts = fresh.map((m) => m.content || m.transcription || "");
    const language = guessLanguage(conv, texts);

    // STOP : retrait du consentement marketing (les messages de dossier continuent).
    if (texts.some((t) => STOP_WORDS.has(normalizeText(t)))) {
      await query(`UPDATE wa_contacts SET marketing_opt_in = FALSE WHERE id = ? AND agency_id = ?`, [conv.contact_id, agencyId]);
      await query(`INSERT INTO wa_consents (agency_id, contact_id, action, source, text_shown) VALUES (?, ?, 'retrait', 'whatsapp_stop', ?)`, [
        agencyId,
        conv.contact_id,
        texts.find((t) => STOP_WORDS.has(normalizeText(t))),
      ]);
      await safeSend(agencyId, conversationId, pickMessage(settings, "stop_confirmation", language));
      return { action: "stop" };
    }

    // Urgence : traitée immédiatement, quel que soit le statut, 24h/24.
    const urgent = settings.transfer_keywords.find((k) => k.reason === "urgence" && texts.some((t) => containsKeyword(t, k.keyword)));
    if (urgent) {
      await transferConversation(agencyId, conversationId, { reason: "urgence", summary: texts.join(" / ").slice(0, 500) });
      await safeSend(agencyId, conversationId, pickMessage(settings, "urgence", language));
      return { action: "urgence" };
    }

    // Déjà chez un humain : aucune réponse automatique (HU-05), sauf UN
    // avertissement hors horaires ; le délai de prise en charge repart.
    if (conv.status === "humain" || conv.status === "attente") {
      const schedule = await getBusinessHours(agencyId);
      const open = isOpenAt(schedule);
      const updates = [];
      const params = [];
      if (conv.status === "attente") updates.push("status = 'humain'");
      if (!conv.sla_due_at) {
        const rule = await getSlaRule(conv.transfer_reason || "demande_humain", agencyId);
        updates.push("sla_due_at = ?", "sla_alert_level = 0", "first_human_reply_at = NULL", "transferred_at = UTC_TIMESTAMP()");
        params.push(toSql(computeSlaDue(schedule, rule)));
      }
      if (!open && !conv.ooh_notice_sent_at) {
        await safeSend(
          agencyId,
          conversationId,
          pickMessage(settings, "waiting_human", language, { OUVERTURE: nextOpeningLabel(schedule, new Date(), language === "ar" ? "ar" : "fr") })
        );
        updates.push("ooh_notice_sent_at = UTC_TIMESTAMP()");
      }
      if (updates.length) {
        await query(`UPDATE wa_conversations SET ${updates.join(", ")} WHERE id = ? AND agency_id = ?`, [...params, conversationId, agencyId]);
      }
      const title = `Nouveau message de ${conv.profile_name || `+${conv.phone}`}`;
      if (conv.assigned_staff_id) await notify({ staffId: conv.assigned_staff_id, kind: "message", title, body: texts.join(" / ").slice(0, 300), conversationId }, agencyId);
      else await notify({ team: conv.team || "ventes", kind: "message", title, body: texts.join(" / ").slice(0, 300), conversationId }, agencyId);
      return { action: "humain" };
    }

    // Conversation rouverte par un client qui a un conseiller attitré et un
    // dossier ouvert : directement à son conseiller (cahier §6.1).
    if (!conv.ai_last_handled_message_id) {
      const [previous] = await query(
        `SELECT id FROM wa_conversations WHERE contact_id = ? AND agency_id = ? AND id < ? AND status = 'resolu' LIMIT 1`,
        [conv.contact_id, agencyId, conversationId]
      );
      const advisor = previous ? await findAdvisor(agencyId, conv) : null;
      if (advisor && conv.traveler_id) {
        const [open] = await query(
          `SELECT r.id FROM registrations r JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
           WHERE r.agency_id = ? AND r.traveler_id = ? AND r.status <> 'annule' AND t.return_date >= CURDATE() LIMIT 1`,
          [agencyId, conv.traveler_id]
        );
        if (open) {
          await transferConversation(agencyId, conversationId, { reason: "demande_humain", summary: "Client avec conseiller attitré et dossier ouvert.", aiSummary: false });
          await safeSend(agencyId, conversationId, await transferMessageFor(agencyId, settings, language, "demande_humain"));
          return { action: "conseiller_attitre" };
        }
      }
    }

    // Agent désactivé, ou clé Claude absente : tout va aux humains.
    if (settings.mode === "off" || !isAiConfigured()) {
      await transferConversation(agencyId, conversationId, { reason: settings.mode === "off" ? "demande_humain" : "echec_ia", aiSummary: false });
      await safeSend(agencyId, conversationId, await transferMessageFor(agencyId, settings, language, "demande_humain"));
      return { action: settings.mode === "off" ? "ia_desactivee" : "ia_non_configuree" };
    }

    // Vocal seul, sans transcription : un humain l'écoutera.
    if (fresh.every((m) => m.type === "audio" && !m.transcription)) {
      await transferConversation(agencyId, conversationId, { reason: "vocal_non_transcrit", aiSummary: false });
      await safeSend(agencyId, conversationId, pickMessage(settings, "vocal_not_transcribed", language));
      return { action: "vocal_non_transcrit" };
    }

    // Plafond mensuel de coût atteint : l'IA passe en copilote (CL-09).
    let copilot = settings.mode === "copilote" || conv.status === "copilote";
    if (settings.monthly_cost_cap_usd != null && (await monthToDateCost(agencyId)) >= settings.monthly_cost_cap_usd) {
      copilot = true;
      const [already] = await query(
        `SELECT id FROM staff_notifications WHERE agency_id = ? AND kind = 'plafond_ia' AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01') LIMIT 1`,
        [agencyId]
      );
      if (!already) {
        await notify({ team: "direction", kind: "plafond_ia", title: `Plafond mensuel IA atteint (${settings.monthly_cost_cap_usd} $) : l'agent est passé en mode copilote.` }, agencyId);
      }
    }

    const result = await runAgentForConversation(agencyId, conv, settings, { newSinceId: lastHandled });
    await applyAgentResult(agencyId, conv, settings, result, { copilot, language, replyTo: fresh[fresh.length - 1] });
    return { action: copilot ? "brouillon" : "reponse", outcome: result.outcome };
  } finally {
    await releaseLock(agencyId, conversationId, handledUpTo);
  }
}

// Médias joints aux messages récents (fourni par le worker, accès disque).
let mediaLoader = null;
export function setMediaLoader(fn) {
  mediaLoader = fn;
}

export async function runAgentForConversation(agencyId, conv, settings, { newSinceId }) {
  const rows = await query(
    `SELECT * FROM (
       SELECT * FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND is_private_note = FALSE
         AND (draft_status IS NULL OR draft_status = 'envoye') AND processing_status <> 'ignore' AND status <> 'echec'
       ORDER BY id DESC LIMIT ${Number(settings.history_size)}
     ) recent ORDER BY id ASC`,
    [conv.id, agencyId]
  );
  const messages = await historyToMessages(rows, { newSinceId, loadMedia: mediaLoader ? (m) => mediaLoader(agencyId, m) : null });
  const [traveler] = conv.traveler_id
    ? await query(`SELECT id, full_name FROM travelers WHERE id = ? AND agency_id = ?`, [conv.traveler_id, agencyId])
    : [null];
  const [latestMedia] = await query(
    `SELECT md.id, md.kind, md.mime_type FROM wa_media md
     JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
     WHERE m.conversation_id = ? AND md.agency_id = ? AND m.direction = 'entrant' AND md.storage_path IS NOT NULL
     ORDER BY md.id DESC LIMIT 1`,
    [conv.id, agencyId]
  );
  const firstExchange = !conv.welcomed;
  const language = conv.language || "fr";
  const ctx = {
    agencyId,
    sandbox: false,
    contact: { id: conv.contact_id, profile_name: conv.profile_name, qualification: conv.qualification, traveler_id: conv.traveler_id, language: conv.language, stage: conv.stage },
    latestMedia: latestMedia || null,
    enabledTools: settings.tools_enabled,
    transferHint: await transferMessageFor(agencyId, settings, language, "demande_humain"),
    effects: { transfer: null, tasks: [], outbound: [], language: null },
  };
  const [stablePrompt, dynamicContext] = await Promise.all([
    buildStablePrompt(agencyId, settings),
    buildDynamicContext(agencyId, settings, { contact: ctx.contact, traveler, firstExchange }),
  ]);
  if (messages.length === 0) return { outcome: "vide", text: "", ctx, toolCalls: [] };
  const result = await runAgent({ settings, messages, stablePrompt, dynamicContext, ctx, log: { conversationId: conv.id } });
  return { ...result, ctx };
}

export async function applyAgentResult(agencyId, conv, settings, result, { copilot, language, replyTo }) {
  const { ctx } = result;
  const effects = ctx.effects;
  const failed = ["erreur", "refus", "limite_outils", "vide"].includes(result.outcome);

  if (effects.language) {
    await query(`UPDATE wa_contacts SET language = ? WHERE id = ? AND agency_id = ?`, [effects.language, conv.contact_id, agencyId]);
  }

  for (const task of effects.tasks) {
    const assignedStaffId = task.type === "rappel" ? await findAdvisor(agencyId, conv) : null;
    const taskId = await createTask(
      { ...task, assignedStaffId, conversationId: conv.id, contactId: conv.contact_id },
      agencyId
    );
    await notify(
      { staffId: assignedStaffId, team: assignedStaffId ? null : task.team, kind: "tache", title: task.title, conversationId: conv.id, taskId },
      agencyId
    );
  }

  if (failed) {
    // CL-07 / NF-04 : message d'attente puis transfert, jamais de silence.
    await safeSend(agencyId, conv.id, pickMessage(settings, "technical_wait", language));
    await transferConversation(agencyId, conv.id, {
      reason: "echec_ia",
      summary: `Agent IA : ${result.outcome}${result.error ? ` (${result.error})` : ""}`,
    });
    return;
  }

  if (copilot) {
    const extras = effects.outbound.map((o) =>
      o.kind === "image"
        ? `[Brochure proposée : ${o.url}]`
        : o.kind === "interactive"
        ? `${o.body}\n${o.options.map((x) => `• ${x.titre}`).join("\n")}`
        : `[Message proposé : ${o.text}]`
    );
    const draft = [...extras, result.text].filter(Boolean).join("\n");
    if (draft) await saveDraft(agencyId, conv.id, draft, result.logId);
    // Équipe ventes par défaut : sans équipe, un conseiller dont le périmètre
    // est « son équipe » ne verrait pas le brouillon qu'il doit valider.
    await query(`UPDATE wa_conversations SET welcomed = TRUE, team = COALESCE(team, 'ventes') WHERE id = ? AND agency_id = ?`, [conv.id, agencyId]);
    if (effects.transfer) {
      await transferConversation(agencyId, conv.id, { reason: effects.transfer.reason, summary: effects.transfer.summary });
    } else {
      await notify(
        { staffId: conv.assigned_staff_id || null, team: conv.assigned_staff_id ? null : "ventes", kind: "brouillon", title: `Réponse IA à valider : ${conv.profile_name || `+${conv.phone}`}`, conversationId: conv.id },
        agencyId
      );
    }
    return;
  }

  for (const o of effects.outbound) {
    try {
      if (o.kind === "image") await sendConversationImage(agencyId, conv.id, o.url, o.caption, { iaLogId: result.logId });
      else if (o.kind === "interactive") await sendConversationInteractive(agencyId, conv.id, { body: o.body, options: o.options }, { iaLogId: result.logId });
      else await sendConversationText(agencyId, conv.id, o.text, { author: "ia", iaLogId: result.logId });
    } catch (err) {
      // Image non téléchargeable par Meta (URL non publique...) : repli texte.
      if (o.kind === "image") await safeSend(agencyId, conv.id, o.caption, { author: "ia", iaLogId: result.logId });
      else console.warn(`[ai] envoi annexe impossible : ${err.message}`);
    }
  }
  if (result.text) {
    await safeSend(agencyId, conv.id, result.text, { author: "ia", iaLogId: result.logId, replyToMetaId: null });
  }
  await query(`UPDATE wa_conversations SET welcomed = TRUE WHERE id = ? AND agency_id = ?`, [conv.id, agencyId]);
  if (effects.transfer) {
    await transferConversation(agencyId, conv.id, { reason: effects.transfer.reason, summary: effects.transfer.summary });
  }
}

// Tours IA perdus (worker arrêté pendant le délai de regroupement, Redis
// redémarré) : dernier message entrant traité mais jamais pris en compte par
// l'agent, depuis plus de 2 minutes (et moins de 24 h). Toutes agences.
export async function listStaleAiTurns(limit = 100) {
  return query(
    `SELECT c.id AS conversation_id, c.agency_id, MAX(m.id) AS message_id
     FROM wa_conversations c -- agency-lint-ok: balayage worker, agence portée par chaque ligne
     JOIN wa_messages m ON m.conversation_id = c.id AND m.agency_id = c.agency_id
     WHERE m.direction = 'entrant' AND m.processing_status = 'traite'
       AND m.id > COALESCE(c.ai_last_handled_message_id, 0)
       AND m.created_at < UTC_TIMESTAMP() - INTERVAL 2 MINUTE
       AND m.created_at > UTC_TIMESTAMP() - INTERVAL 24 HOUR
       AND (c.ai_lock_until IS NULL OR c.ai_lock_until < UTC_TIMESTAMP())
       AND c.status <> 'resolu'
     GROUP BY c.id, c.agency_id LIMIT ${Number(limit)}`
  );
}
