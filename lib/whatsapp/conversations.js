import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { hasPermission } from "../permissions";
import { sendConversationText, addPrivateNote, isServiceWindowOpen } from "./outbound";
import { transferConversation } from "./handoff";
import { redactText } from "../ai/redact";
import { notify } from "./team";

// Inbox intégrée à l'admin (décision du 07/10/2026 : pas de Chatwoot).
// Droits (matrice du cahier §3, via les permissions existantes) :
//   - whatsapp.conversations.all : toutes les conversations de l'agence ;
//   - whatsapp.conversations.own : celles qui lui sont assignées ou à son
//     équipe (= son rôle) ;
//   - direction : tout (filet de sécurité de hasPermission).

const notFound = () => {
  const err = new Error("Ressource introuvable");
  err.code = "NOT_FOUND";
  return err;
};

export async function inboxScope(session) {
  if (await hasPermission(session, "whatsapp.conversations.all")) return "all";
  if (await hasPermission(session, "whatsapp.conversations.own")) return "own";
  return null;
}

function scopeSql(scope, session) {
  if (scope === "all") return { sql: "", params: [] };
  return { sql: " AND (c.assigned_staff_id = ? OR (c.assigned_staff_id IS NULL AND c.team = ?))", params: [session.id, session.role] };
}

export async function listConversations(session, filters = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const scope = await inboxScope(session);
  if (!scope) return [];
  const where = ["c.agency_id = ?"];
  const params = [agencyId];
  const s = scopeSql(scope, session);
  if (filters.status === "ouvertes") where.push("c.status <> 'resolu'");
  else if (filters.status) {
    where.push("c.status = ?");
    params.push(filters.status);
  }
  if (filters.mine) {
    where.push("c.assigned_staff_id = ?");
    params.push(session.id);
  }
  if (filters.reason) {
    where.push("c.transfer_reason = ?");
    params.push(filters.reason);
  }
  if (filters.q) {
    where.push("(ct.profile_name LIKE ? OR ct.phone LIKE ? OR tr.full_name LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  return query(
    `SELECT c.id, c.status, c.team, c.priority, c.transfer_reason, c.assigned_staff_id, c.last_inbound_at, c.sla_due_at,
       (c.sla_due_at < UTC_TIMESTAMP()) AS sla_late,
       c.first_human_reply_at, c.updated_at, c.opened_at,
       ct.id AS contact_id, ct.phone, ct.profile_name, ct.stage, ct.language, tr.full_name AS traveler_name,
       su.full_name AS assigned_name,
       (SELECT m.content FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
          AND m.is_private_note = FALSE ORDER BY m.id DESC LIMIT 1) AS last_message,
       (SELECT m.direction FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
          AND m.is_private_note = FALSE ORDER BY m.id DESC LIMIT 1) AS last_direction,
       (SELECT COUNT(*) FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
          AND m.draft_status = 'brouillon') AS drafts,
       (SELECT MAX(m.created_at) FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
          AND m.is_private_note = FALSE) AS last_activity_at
     FROM wa_conversations c
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     LEFT JOIN travelers tr ON tr.id = ct.traveler_id AND tr.agency_id = c.agency_id
     LEFT JOIN staff_users su ON su.id = c.assigned_staff_id AND su.agency_id = c.agency_id
     WHERE ${where.join(" AND ")}${s.sql}
     ORDER BY FIELD(c.priority, 'urgente', 'haute', 'normale', 'basse'), last_activity_at DESC
     LIMIT 200`,
    [...params, ...s.params]
  );
}

export async function getConversation(session, conversationId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const scope = await inboxScope(session);
  if (!scope) throw notFound();
  const s = scopeSql(scope, session);
  const [conv] = await query(
    `SELECT c.*, ct.phone, ct.profile_name, ct.stage, ct.language, ct.source, ct.qualification, ct.traveler_id,
       ct.advisor_staff_id, ct.marketing_opt_in, ct.blocked, ct.created_at AS contact_created_at,
       tr.full_name AS traveler_name, su.full_name AS assigned_name, adv.full_name AS advisor_name
     FROM wa_conversations c
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     LEFT JOIN travelers tr ON tr.id = ct.traveler_id AND tr.agency_id = c.agency_id
     LEFT JOIN staff_users su ON su.id = c.assigned_staff_id AND su.agency_id = c.agency_id
     LEFT JOIN staff_users adv ON adv.id = ct.advisor_staff_id AND adv.agency_id = c.agency_id
     WHERE c.id = ? AND c.agency_id = ?${s.sql}`,
    [conversationId, agencyId, ...s.params]
  );
  if (!conv) throw notFound();
  const messages = await query(
    `SELECT m.id, m.direction, m.author, m.author_staff_id, m.is_private_note, m.draft_status, m.type, m.content,
       m.transcription, m.status, m.error_message, m.created_at, m.ia_log_id, su.full_name AS staff_name,
       (SELECT md.id FROM wa_media md WHERE md.message_id = m.id AND md.agency_id = m.agency_id AND md.storage_path IS NOT NULL LIMIT 1) AS media_id,
       (SELECT md.mime_type FROM wa_media md WHERE md.message_id = m.id AND md.agency_id = m.agency_id LIMIT 1) AS media_mime,
       (SELECT md.doc_type FROM wa_media md WHERE md.message_id = m.id AND md.agency_id = m.agency_id LIMIT 1) AS media_doc_type,
       l.tools AS ia_tools, l.cost_usd AS ia_cost, l.outcome AS ia_outcome, l.evaluation AS ia_evaluation
     FROM wa_messages m
     LEFT JOIN staff_users su ON su.id = m.author_staff_id AND su.agency_id = m.agency_id
     LEFT JOIN ia_logs l ON l.id = m.ia_log_id AND l.agency_id = m.agency_id
     WHERE m.conversation_id = ? AND m.agency_id = ?
     ORDER BY m.id ASC LIMIT 500`,
    [conversationId, agencyId]
  );
  const registrations = conv.traveler_id
    ? await query(
        `SELECT r.id, r.status, r.visa_status, r.group_id, p.title AS program_title, t.departure_date
         FROM registrations r
         JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
         JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
         WHERE r.agency_id = ? AND r.traveler_id = ? ORDER BY t.departure_date DESC LIMIT 10`,
        [agencyId, conv.traveler_id]
      )
    : [];
  const history = await query(
    `SELECT id, status, opened_at, resolved_at, transfer_reason FROM wa_conversations
     WHERE contact_id = ? AND agency_id = ? AND id <> ? ORDER BY id DESC LIMIT 10`,
    [conv.contact_id, agencyId, conversationId]
  );
  const windowOpen = await isServiceWindowOpen(agencyId, conversationId);
  return { conversation: conv, messages, registrations, history, windowOpen };
}

// Toutes les actions passent par ici : vérifie l'accès (lecture) avant d'agir.
async function ensureAccess(session, conversationId, agencyId) {
  await getConversation(session, conversationId, agencyId);
}

export async function takeOver(session, conversationId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  await query(
    `UPDATE wa_conversations SET status = 'humain', assigned_staff_id = ?, team = ?, sla_due_at = NULL,
       transfer_reason = COALESCE(transfer_reason, 'prise_en_main'), transferred_at = COALESCE(transferred_at, UTC_TIMESTAMP())
     WHERE id = ? AND agency_id = ?`,
    [session.id, session.role, conversationId, agencyId]
  );
  await addPrivateNote(agencyId, conversationId, `${session.fullName} a pris la main.`, { staffId: session.id });
}

export async function giveBackToAi(session, conversationId, { copilot = false } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  await query(
    `UPDATE wa_conversations SET status = ?, assigned_staff_id = NULL, team = NULL, transfer_reason = NULL,
       sla_due_at = NULL, sla_alert_level = 0, ooh_notice_sent_at = NULL
     WHERE id = ? AND agency_id = ?`,
    [copilot ? "copilote" : "ia", conversationId, agencyId]
  );
  // Les messages déjà reçus ne déclenchent pas de réponse rétroactive.
  await query(
    `UPDATE wa_conversations SET ai_last_handled_message_id = (
       SELECT MAX(id) FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND direction = 'entrant')
     WHERE id = ? AND agency_id = ?`,
    [conversationId, agencyId, conversationId, agencyId]
  );
  await addPrivateNote(agencyId, conversationId, `${session.fullName} a rendu la conversation à l'IA${copilot ? " (mode copilote)" : ""}.`, { staffId: session.id });
}

export async function setWaiting(session, conversationId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  await query(`UPDATE wa_conversations SET status = 'attente', sla_due_at = NULL WHERE id = ? AND agency_id = ?`, [conversationId, agencyId]);
}

export async function resolveConversation(session, conversationId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  await query(
    `UPDATE wa_conversations SET status = 'resolu', resolved_at = UTC_TIMESTAMP(), sla_due_at = NULL WHERE id = ? AND agency_id = ?`,
    [conversationId, agencyId]
  );
  await addPrivateNote(agencyId, conversationId, `Conversation résolue par ${session.fullName}.`, { staffId: session.id });
}

// Réassignation (HU-10 : transfert entre équipes avec note obligatoire).
export async function reassign(session, conversationId, { staffId = null, team = null, note }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  if (!String(note || "").trim()) {
    const err = new Error("Une note est obligatoire pour réassigner une conversation.");
    err.code = "VALIDATION";
    throw err;
  }
  let targetTeam = team || null;
  if (staffId) {
    await assertOwned("staff_users", staffId, agencyId);
    const [staff] = await query(
      `SELECT r.name AS role FROM staff_users su JOIN roles r ON r.id = su.role_id AND r.agency_id = su.agency_id
       WHERE su.id = ? AND su.agency_id = ?`,
      [staffId, agencyId]
    );
    targetTeam = targetTeam || staff?.role || null;
  }
  await query(
    `UPDATE wa_conversations SET status = IF(status IN ('ia', 'copilote', 'resolu'), 'humain', status),
       assigned_staff_id = ?, team = ?, transferred_at = UTC_TIMESTAMP(), first_human_reply_at = NULL, sla_alert_level = 0
     WHERE id = ? AND agency_id = ?`,
    [staffId || null, targetTeam, conversationId, agencyId]
  );
  await addPrivateNote(agencyId, conversationId, `Réassignée par ${session.fullName} : ${note.trim()}`, { staffId: session.id });
  await notify(
    { staffId: staffId || null, team: staffId ? null : targetTeam, kind: "transfert", title: `Conversation réassignée par ${session.fullName}`, body: note.trim(), conversationId },
    agencyId
  );
}

// Message d'un conseiller (fenêtre 24h ouverte). Écrire = prendre la main.
export async function sendStaffMessage(session, conversationId, text, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  const body = String(text || "").trim();
  if (!body) {
    const err = new Error("Message vide.");
    err.code = "VALIDATION";
    throw err;
  }
  const result = await sendConversationText(agencyId, conversationId, body, { author: "humain", staffId: session.id });
  await markHumanReply(session, conversationId, agencyId);
  return result;
}

export async function markHumanReply(session, conversationId, agencyId) {
  await query(
    `UPDATE wa_conversations SET status = IF(status IN ('ia', 'copilote'), 'humain', status),
       assigned_staff_id = COALESCE(assigned_staff_id, ?), team = COALESCE(team, ?),
       first_human_reply_at = COALESCE(first_human_reply_at, UTC_TIMESTAMP()), sla_due_at = NULL, ooh_notice_sent_at = NULL
     WHERE id = ? AND agency_id = ?`,
    [session.id, session.role, conversationId, agencyId]
  );
}

export async function addStaffNote(session, conversationId, text, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  if (!String(text || "").trim()) {
    const err = new Error("Note vide.");
    err.code = "VALIDATION";
    throw err;
  }
  return addPrivateNote(agencyId, conversationId, String(text).trim(), { staffId: session.id });
}

async function loadDraft(agencyId, conversationId, messageId) {
  const [draft] = await query(
    `SELECT * FROM wa_messages WHERE id = ? AND conversation_id = ? AND agency_id = ? AND draft_status = 'brouillon'`,
    [messageId, conversationId, agencyId]
  );
  if (!draft) throw notFound();
  return draft;
}

// Mode copilote (IA-14) : le conseiller valide (éventuellement après
// correction) ou rejette la réponse rédigée par l'IA.
export async function approveDraft(session, conversationId, messageId, editedText, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  const draft = await loadDraft(agencyId, conversationId, messageId);
  const text = String(editedText ?? draft.content ?? "").trim();
  if (!text) {
    const err = new Error("Message vide.");
    err.code = "VALIDATION";
    throw err;
  }
  const edited = text !== String(draft.content || "").trim();
  await sendConversationText(agencyId, conversationId, text, {
    author: edited ? "humain" : "ia",
    staffId: session.id,
    iaLogId: draft.ia_log_id,
    existingMessageId: draft.id,
  });
  if (edited && draft.ia_log_id) {
    await query(
      `UPDATE ia_logs SET evaluation = 'a_corriger', evaluation_note = ? WHERE id = ? AND agency_id = ?`,
      [`Corrigé avant envoi : ${redactText(text)}`, draft.ia_log_id, agencyId]
    );
  }
  await query(`UPDATE wa_conversations SET first_human_reply_at = COALESCE(first_human_reply_at, UTC_TIMESTAMP()), sla_due_at = NULL WHERE id = ? AND agency_id = ?`, [conversationId, agencyId]);
}

export async function rejectDraft(session, conversationId, messageId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  const draft = await loadDraft(agencyId, conversationId, messageId);
  await query(`UPDATE wa_messages SET draft_status = 'rejete' WHERE id = ? AND agency_id = ?`, [draft.id, agencyId]);
}

// Évaluation d'une réponse IA par un conseiller (HU-13) : « à corriger »
// alimente la file des questions sans réponse (base de connaissances).
export async function evaluateAiMessage(session, conversationId, messageId, { evaluation, correction }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  if (!["bonne", "a_corriger"].includes(evaluation)) throw new Error("Évaluation invalide");
  const [msg] = await query(
    `SELECT id, ia_log_id, content FROM wa_messages WHERE id = ? AND conversation_id = ? AND agency_id = ? AND ia_log_id IS NOT NULL`,
    [messageId, conversationId, agencyId]
  );
  if (!msg) throw notFound();
  await query(`UPDATE ia_logs SET evaluation = ?, evaluation_note = ? WHERE id = ? AND agency_id = ?`, [
    evaluation,
    correction ? redactText(String(correction)) : null,
    msg.ia_log_id,
    agencyId,
  ]);
  if (evaluation === "a_corriger") {
    const [question] = await query(
      `SELECT content, transcription FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND direction = 'entrant' AND id < ?
       ORDER BY id DESC LIMIT 1`,
      [conversationId, agencyId, messageId]
    );
    await query(
      `INSERT INTO ia_unanswered (agency_id, conversation_id, question, origin, correction) VALUES (?, ?, ?, 'correction', ?)`,
      [agencyId, conversationId, redactText(question?.content || question?.transcription || msg.content || ""), correction ? redactText(String(correction)) : null]
    );
  }
}

// Fiche contact (panneau CRM de l'inbox).
export async function updateContact(session, conversationId, data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  const [conv] = await query(`SELECT contact_id FROM wa_conversations WHERE id = ? AND agency_id = ?`, [conversationId, agencyId]);
  const contactId = conv.contact_id;
  if (data.advisorStaffId !== undefined) {
    if (data.advisorStaffId) await assertOwned("staff_users", data.advisorStaffId, agencyId);
    await query(`UPDATE wa_contacts SET advisor_staff_id = ? WHERE id = ? AND agency_id = ?`, [data.advisorStaffId || null, contactId, agencyId]);
  }
  if (data.blocked !== undefined) {
    await query(`UPDATE wa_contacts SET blocked = ? WHERE id = ? AND agency_id = ?`, [data.blocked ? 1 : 0, contactId, agencyId]);
  }
  if (data.marketingOptIn !== undefined) {
    await query(`UPDATE wa_contacts SET marketing_opt_in = ? WHERE id = ? AND agency_id = ?`, [data.marketingOptIn ? 1 : 0, contactId, agencyId]);
    await query(`INSERT INTO wa_consents (agency_id, contact_id, action, source, text_shown) VALUES (?, ?, ?, 'admin', ?)`, [
      agencyId,
      contactId,
      data.marketingOptIn ? "accord" : "retrait",
      `Modifié par ${session.fullName}`,
    ]);
  }
  if (data.profileName !== undefined) {
    await query(`UPDATE wa_contacts SET profile_name = ? WHERE id = ? AND agency_id = ?`, [String(data.profileName || "").trim() || null, contactId, agencyId]);
  }
}

// Transfert manuel vers une équipe selon un motif (ex. depuis une
// conversation IA qu'un superviseur juge à reprendre).
export async function manualTransfer(session, conversationId, reason, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await ensureAccess(session, conversationId, agencyId);
  return transferConversation(agencyId, conversationId, { reason, summary: `Transfert manuel par ${session.fullName}`, aiSummary: true });
}

// Compteurs pour la navigation (conversations en attente d'un humain).
export async function countPendingForStaff(session, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const scope = await inboxScope(session);
  if (!scope) return 0;
  const s = scopeSql(scope, session);
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM wa_conversations c WHERE c.agency_id = ? AND c.status = 'humain' AND c.first_human_reply_at IS NULL${s.sql}`,
    [agencyId, ...s.params]
  );
  return Number(row?.n || 0);
}

// Médias d'une conversation accessible (route protégée de l'inbox).
export async function getMediaForStaff(session, mediaId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [media] = await query(
    `SELECT md.*, m.conversation_id FROM wa_media md JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
     WHERE md.id = ? AND md.agency_id = ? AND md.storage_path IS NOT NULL`,
    [mediaId, agencyId]
  );
  if (!media) throw notFound();
  await ensureAccess(session, media.conversation_id, agencyId);
  return media;
}
