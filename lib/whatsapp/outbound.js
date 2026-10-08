import { query } from "../db";
import { getAccountCredentials } from "./accounts";
import { sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage } from "./graph";

// Envois sortants vers WhatsApp, enregistrés dans wa_messages (sortant).
// Utilisé par le worker (agent IA) ET par les routes de l'inbox (conseiller),
// d'où ce module sans accès disque (voir lib/whatsapp/processing.js).
// L'agence est toujours passée explicitement.

// Fenêtre de service client de 24h (WA-09) : un message libre n'est permis
// que si le client a écrit dans les dernières 24h ; sinon, template requis.
export async function isServiceWindowOpen(agencyId, conversationId) {
  const rows = await query(
    `SELECT last_inbound_at > UTC_TIMESTAMP() - INTERVAL 24 HOUR AS open
     FROM wa_conversations WHERE id = ? AND agency_id = ?`,
    [conversationId, agencyId]
  );
  return Boolean(rows[0]?.open);
}

async function loadTarget(agencyId, conversationId) {
  const rows = await query(
    `SELECT c.id, ct.phone, ct.blocked FROM wa_conversations c
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE c.id = ? AND c.agency_id = ?`,
    [conversationId, agencyId]
  );
  const conv = rows[0];
  if (!conv) {
    const err = new Error("Ressource introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (conv.blocked) {
    const err = new Error("Contact bloqué : aucun envoi possible.");
    err.code = "BLOCKED";
    throw err;
  }
  return conv;
}

async function credentials(agencyId) {
  const creds = await getAccountCredentials(agencyId);
  if (!creds?.accessToken) {
    const err = new Error("Compte WhatsApp non configuré (jeton manquant).");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  return creds;
}

// Enregistre le message (ou reprend un brouillon existant), l'envoie, puis
// met à jour son statut. `send(creds, phone)` effectue l'appel Graph API.
async function recordAndSend(agencyId, conversationId, row, send) {
  const conv = await loadTarget(agencyId, conversationId);
  const creds = await credentials(agencyId);
  let messageId = row.existingMessageId;
  if (messageId) {
    await query(
      `UPDATE wa_messages SET content = ?, author = ?, author_staff_id = ?, status = 'en_attente', draft_status = 'envoye'
       WHERE id = ? AND agency_id = ? AND conversation_id = ?`,
      [row.content, row.author, row.staffId, messageId, agencyId, conversationId]
    );
  } else {
    const insert = await query(
      `INSERT INTO wa_messages (agency_id, conversation_id, direction, author, author_staff_id, type, content,
         status, processing_status, reply_to_meta_id, ia_log_id, template_id, campaign_id)
       VALUES (?, ?, 'sortant', ?, ?, ?, ?, 'en_attente', 'traite', ?, ?, ?, ?)`,
      [agencyId, conversationId, row.author, row.staffId, row.type, row.content, row.replyToMetaId || null, row.iaLogId || null, row.templateId || null, row.campaignId || null]
    );
    messageId = insert.insertId;
  }
  try {
    const { metaMessageId, raw } = await send(creds, conv.phone);
    await query(`UPDATE wa_messages SET meta_message_id = ?, status = 'envoye', payload = ? WHERE id = ? AND agency_id = ?`, [
      metaMessageId,
      JSON.stringify(raw),
      messageId,
      agencyId,
    ]);
    return { messageId, metaMessageId };
  } catch (err) {
    await query(`UPDATE wa_messages SET status = 'echec', error_code = ?, error_message = ? WHERE id = ? AND agency_id = ?`, [
      err.code != null ? String(err.code) : null,
      String(err.message).slice(0, 255),
      messageId,
      agencyId,
    ]);
    throw err;
  }
}

async function requireWindow(agencyId, conversationId) {
  if (!(await isServiceWindowOpen(agencyId, conversationId))) {
    const err = new Error("Fenêtre de 24h fermée : seul un template Meta peut être envoyé.");
    err.code = "WINDOW_CLOSED";
    throw err;
  }
}

export async function sendConversationText(
  agencyId,
  conversationId,
  text,
  { author = "systeme", staffId = null, replyToMetaId = null, iaLogId = null, existingMessageId = null } = {}
) {
  await requireWindow(agencyId, conversationId);
  return recordAndSend(
    agencyId,
    conversationId,
    { author, staffId, type: "text", content: text, replyToMetaId, iaLogId, existingMessageId },
    (creds, phone) => sendTextMessage(creds.accessToken, creds.phoneNumberId, phone, text, { replyToMetaId })
  );
}

export async function sendConversationImage(agencyId, conversationId, link, caption, { author = "ia", iaLogId = null } = {}) {
  await requireWindow(agencyId, conversationId);
  return recordAndSend(
    agencyId,
    conversationId,
    { author, staffId: null, type: "image", content: caption || link, iaLogId },
    (creds, phone) => sendImageMessage(creds.accessToken, creds.phoneNumberId, phone, link, caption)
  );
}

// Template : autorisé fenêtre fermée. `renderedText` = aperçu enregistré.
export async function sendConversationTemplate(agencyId, conversationId, template, components, renderedText, { staffId = null, author = "humain", campaignId = null } = {}) {
  return recordAndSend(
    agencyId,
    conversationId,
    { author, staffId, type: "template", content: renderedText, templateId: template.id, campaignId },
    (creds, phone) => sendTemplateMessage(creds.accessToken, creds.phoneNumberId, phone, template.name, template.language, components)
  );
}

// Brouillon du mode copilote (IA-14) : enregistré, jamais envoyé sans validation.
export async function saveDraft(agencyId, conversationId, text, iaLogId) {
  const result = await query(
    `INSERT INTO wa_messages (agency_id, conversation_id, direction, author, type, content, status, processing_status,
       draft_status, ia_log_id)
     VALUES (?, ?, 'sortant', 'ia', 'text', ?, 'en_attente', 'traite', 'brouillon', ?)`,
    [agencyId, conversationId, text, iaLogId || null]
  );
  return result.insertId;
}

// Note privée (jamais envoyée au client) : résumé de transfert, commentaire.
export async function addPrivateNote(agencyId, conversationId, text, { staffId = null } = {}) {
  const result = await query(
    `INSERT INTO wa_messages (agency_id, conversation_id, direction, author, author_staff_id, is_private_note, type,
       content, status, processing_status)
     VALUES (?, ?, 'sortant', ?, ?, TRUE, 'note', ?, 'recu', 'traite')`,
    [agencyId, conversationId, staffId ? "humain" : "systeme", staffId, text]
  );
  return result.insertId;
}

// Boutons de réponse (1 à 3) ou liste (jusqu'à 10) — IA-12 : l'agent propose
// des choix cliquables plutôt que des menus numérotés.
export async function sendConversationInteractive(agencyId, conversationId, { body, options }, { author = "ia", iaLogId = null } = {}) {
  await requireWindow(agencyId, conversationId);
  const buttons = options.map((o, i) => ({ id: o.id || `opt_${i + 1}`, title: String(o.titre || o.title || "").trim() })).filter((b) => b.title);
  const summary = `${body}\n${buttons.map((b) => `• ${b.title}`).join("\n")}`;
  return recordAndSend(
    agencyId,
    conversationId,
    { author, staffId: null, type: "interactive", content: summary, iaLogId },
    (creds, phone) => sendInteractiveMessage(creds.accessToken, creds.phoneNumberId, phone, { body, buttons, listButton: "Choisir" })
  );
}
