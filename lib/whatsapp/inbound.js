import { getPool, query } from "../db";
import { normalizeWaId, phoneLookupVariants } from "./phone";
import { updateAccountQuality } from "./accounts";
import { applyTemplateWebhook } from "./templates";
import { sourceFromMessage } from "./links";
import { getOpsSettings, priceForCategory } from "./ops";

// Réception WhatsApp (webhook Meta) — partie ENREGISTREMENT uniquement : le
// webhook doit répondre à Meta en moins de 2 s (exigence WA-02), donc il se
// contente d'écrire en base (contact, conversation, message "recu") ; tout le
// reste (téléchargement des médias, transcription, agent IA...) est fait
// ensuite par le worker (worker/index.mjs) via la file d'attente.
// L'agence est TOUJOURS passée explicitement (déduite du phone_number_id par
// l'appelant) — ce module ne lit jamais d'en-tête de requête.

const MEDIA_TYPES = new Set(["audio", "image", "document", "video", "sticker"]);

// Ordre des statuts de livraison : un webhook "livré" arrivé APRÈS "lu" (Meta
// ne garantit pas l'ordre) ne doit pas faire régresser le statut.
const STATUS_RANK = { en_attente: 0, envoye: 1, livre: 2, lu: 3, echec: 4 };
const META_STATUS = { sent: "envoye", delivered: "livre", read: "lu", failed: "echec" };

// Texte lisible d'un message entrant, quel que soit son type (pour l'inbox,
// l'agent IA et la recherche). Le message brut reste dans `payload`.
export function summarizeInboundMessage(msg) {
  switch (msg.type) {
    case "text":
      return msg.text?.body || "";
    case "image":
    case "video":
    case "document":
      return msg[msg.type]?.caption || msg.document?.filename || null;
    case "location": {
      const l = msg.location || {};
      return [l.name, l.address, `${l.latitude},${l.longitude}`].filter(Boolean).join(" — ");
    }
    case "button":
      return msg.button?.text || msg.button?.payload || null;
    case "interactive": {
      const i = msg.interactive || {};
      if (i.button_reply) return i.button_reply.title;
      if (i.list_reply) return i.list_reply.title;
      if (i.nfm_reply) return i.nfm_reply.response_json || null; // formulaire WhatsApp (Flow)
      return null;
    }
    case "contacts":
      return (msg.contacts || []).map((c) => c.name?.formatted_name).filter(Boolean).join(", ") || null;
    case "reaction":
      return msg.reaction?.emoji || null;
    default:
      return null;
  }
}

function epochToSql(ts) {
  const n = Number(ts);
  const d = Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function findTravelerIdByPhone(connection, agencyId, waId) {
  const variants = phoneLookupVariants(waId);
  if (variants.length === 0) return null;
  const [rows] = await connection.execute(
    `SELECT id FROM travelers WHERE agency_id = ? AND phone_whatsapp IN (${variants.map(() => "?").join(", ")})
     ORDER BY id DESC LIMIT 1`,
    [agencyId, ...variants]
  );
  return rows[0]?.id || null;
}

async function upsertContact(connection, agencyId, waId, profileName, referral, receivedAt, linkSource = null) {
  const [rows] = await connection.execute(
    `SELECT id, traveler_id, profile_name FROM wa_contacts WHERE agency_id = ? AND phone = ? FOR UPDATE`,
    [agencyId, waId]
  );
  if (rows[0]) {
    const contact = rows[0];
    const travelerId = contact.traveler_id || (await findTravelerIdByPhone(connection, agencyId, waId));
    await connection.execute(
      `UPDATE wa_contacts SET profile_name = COALESCE(?, profile_name), traveler_id = ?,
         last_inbound_at = GREATEST(COALESCE(last_inbound_at, ?), ?), source = COALESCE(source, ?)
       WHERE id = ? AND agency_id = ?`,
      [profileName || null, travelerId, receivedAt, receivedAt, linkSource, contact.id, agencyId]
    );
    return contact.id;
  }
  const travelerId = await findTravelerIdByPhone(connection, agencyId, waId);
  // Source : lien wa.me / QR code avec code (« [FLYER-RAMADAN] », CP-07),
  // sinon pub "click-to-WhatsApp" (objet referral).
  const source = linkSource || (referral ? `pub_${referral.source_type || "meta"}` : null);
  const [result] = await connection.execute(
    `INSERT INTO wa_contacts (agency_id, phone, profile_name, traveler_id, source, referral, stage, last_inbound_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agencyId,
      waId,
      profileName || null,
      travelerId,
      source,
      referral ? JSON.stringify(referral) : null,
      travelerId ? "inscrit" : "prospect",
      receivedAt,
    ]
  );
  return result.insertId;
}

// Conversation ouverte du contact, ou nouvelle (statut "ia" par défaut). Une
// conversation "resolu" n'est jamais rouverte.
async function findOrOpenConversation(connection, agencyId, contactId, receivedAt, referral) {
  const [rows] = await connection.execute(
    `SELECT id FROM wa_conversations WHERE agency_id = ? AND contact_id = ? AND status <> 'resolu'
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [agencyId, contactId]
  );
  // Fenêtre gratuite de 72h ouverte par un clic sur une pub click-to-WhatsApp.
  const fepUntil = referral ? epochToSql(Date.parse(`${receivedAt.replace(" ", "T")}Z`) / 1000 + 72 * 3600) : null;
  if (rows[0]) {
    await connection.execute(
      `UPDATE wa_conversations SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, ?), ?),
         fep_until = COALESCE(?, fep_until)
       WHERE id = ? AND agency_id = ?`,
      [receivedAt, receivedAt, fepUntil, rows[0].id, agencyId]
    );
    return rows[0].id;
  }
  const [result] = await connection.execute(
    `INSERT INTO wa_conversations (agency_id, contact_id, status, last_inbound_at, fep_until)
     VALUES (?, ?, 'ia', ?, ?)`,
    [agencyId, contactId, receivedAt, fepUntil]
  );
  return result.insertId;
}

// Enregistre UN message entrant (transaction). Retourne l'id du message créé,
// ou null si ce message Meta a déjà été reçu (webhook renvoyé : WA-04).
async function storeInboundMessage(agencyId, msg, contactInfo) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const waId = normalizeWaId(msg.from);
    const receivedAt = epochToSql(msg.timestamp);

    const [dup] = await connection.execute(`SELECT id FROM wa_messages WHERE meta_message_id = ? AND agency_id = ?`, [
      msg.id,
      agencyId,
    ]);
    if (dup[0]) {
      await connection.rollback();
      return null;
    }

    const contactId = await upsertContact(
      connection,
      agencyId,
      waId,
      contactInfo?.profile?.name,
      msg.referral || null,
      receivedAt,
      await sourceFromMessage(connection, agencyId, msg.text?.body)
    );
    const conversationId = await findOrOpenConversation(connection, agencyId, contactId, receivedAt, msg.referral);

    const [result] = await connection.execute(
      `INSERT INTO wa_messages (agency_id, conversation_id, meta_message_id, direction, author, type, content,
         payload, reply_to_meta_id, status, processing_status, created_at)
       VALUES (?, ?, ?, 'entrant', 'client', ?, ?, ?, ?, 'recu', ?, ?)`,
      [
        agencyId,
        conversationId,
        msg.id,
        msg.type || "unknown",
        summarizeInboundMessage(msg),
        JSON.stringify(msg),
        msg.context?.id || null,
        // Une réaction (emoji) ou un type non géré n'appelle aucun traitement.
        msg.type === "reaction" || msg.type === "unsupported" ? "ignore" : "recu",
        receivedAt,
      ]
    );
    const messageId = result.insertId;

    if (MEDIA_TYPES.has(msg.type) && msg[msg.type]?.id) {
      const media = msg[msg.type];
      await connection.execute(
        `INSERT INTO wa_media (agency_id, message_id, meta_media_id, kind, mime_type, sha256, file_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [agencyId, messageId, media.id, msg.type, media.mime_type || null, null, media.filename || null]
      );
    }

    await connection.commit();
    return messageId;
  } catch (err) {
    await connection.rollback();
    // Course entre deux livraisons simultanées du même webhook : la contrainte
    // unique sur meta_message_id a tranché, ce n'est pas une erreur.
    if (err.code === "ER_DUP_ENTRY") return null;
    throw err;
  } finally {
    connection.release();
  }
}

// Statut de livraison d'un message que NOUS avons envoyé (WA-08).
async function applyStatusUpdate(agencyId, status) {
  const newStatus = META_STATUS[status.status];
  if (!newStatus) return;
  const rows = await query(`SELECT id, status FROM wa_messages WHERE meta_message_id = ? AND agency_id = ? LIMIT 1`, [
    status.id,
    agencyId,
  ]);
  const current = rows[0];
  if (!current) return; // message envoyé hors de ce système (ex. depuis le gestionnaire WhatsApp)
  if (newStatus !== "echec" && (STATUS_RANK[current.status] ?? -1) >= STATUS_RANK[newStatus]) return;
  const error = status.errors?.[0];
  // Coût réel (§8.3) : Meta indique dans le statut si le message est facturé
  // et sa catégorie ; le prix vient des tarifs saisis par l'agence.
  let cost = null;
  if (status.pricing && status.pricing.billable !== undefined) {
    cost = status.pricing.billable ? priceForCategory(await getOpsSettings(agencyId), status.pricing.category) : 0;
  }
  await query(
    `UPDATE wa_messages SET status = ?, error_code = COALESCE(?, error_code), error_message = COALESCE(?, error_message),
       billed_category = COALESCE(?, billed_category), cost_mad = COALESCE(?, cost_mad)
     WHERE id = ? AND agency_id = ?`,
    [
      newStatus,
      error?.code != null ? String(error.code) : null,
      error ? String(error.title || error.message || "").slice(0, 255) : null,
      status.pricing?.category || null,
      cost,
      current.id,
      agencyId,
    ]
  );
}

// Traite la partie d'un webhook qui concerne UNE agence (un "change" Meta).
// Retourne les ids des nouveaux messages à confier au worker.
export async function processWebhookChange(agencyId, change) {
  const value = change.value || {};
  const newMessageIds = [];

  if (change.field === "messages") {
    const contactsByWaId = new Map((value.contacts || []).map((c) => [normalizeWaId(c.wa_id), c]));
    for (const msg of value.messages || []) {
      const id = await storeInboundMessage(agencyId, msg, contactsByWaId.get(normalizeWaId(msg.from)));
      if (id) newMessageIds.push(id);
    }
    for (const status of value.statuses || []) {
      await applyStatusUpdate(agencyId, status);
    }
  } else if (change.field === "phone_number_quality_update") {
    await updateAccountQuality(agencyId, {
      qualityRating: value.event || null,
      messagingTier: value.current_limit || null,
    });
  } else if (change.field === "message_template_status_update" || change.field === "template_category_update") {
    // Statut (approuvé, refusé, en pause...) ou reclassement de catégorie d'un
    // template (TP-02, TP-03) — voir lib/whatsapp/templates.js.
    await applyTemplateWebhook(agencyId, change.field, value);
  }
  return newMessageIds;
}

// Le phone_number_id d'un "change" (clé de routage vers l'agence).
export function phoneNumberIdOfChange(change) {
  return change?.value?.metadata?.phone_number_id || null;
}
