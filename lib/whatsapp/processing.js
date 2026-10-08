import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query } from "../db";
import { getAccountCredentials } from "./accounts";
import { getMediaInfo, downloadMedia, markMessageAsRead } from "./graph";
import { transcribeAudio, transcriptionProvider } from "../transcription/index";

// Traitements exécutés par le WORKER (worker/index.mjs), jamais dans une
// requête HTTP. Agence toujours passée explicitement (portée par la tâche).

// Médias reçus : stockés HORS de public/ (NF-09) — jamais servis directement
// par Next.js ; l'accès passera par une route protégée (lot 1).
export function mediaRoot() {
  return path.resolve(process.env.WA_MEDIA_DIR || "storage/wa-media");
}

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
};

function extensionFor(mime, fileName) {
  const base = String(mime || "").split(";")[0].trim();
  if (EXT_BY_MIME[base]) return EXT_BY_MIME[base];
  const fromName = path.extname(fileName || "").slice(1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : "bin";
}

// Prend la main sur un message (évite qu'il soit traité deux fois si la tâche
// a été déposée par le webhook ET par le balayage). Un message resté
// "en_cours" plus de 5 min (worker arrêté en plein traitement) est repris.
export async function claimInboundMessage(agencyId, messageId) {
  const result = await query(
    `UPDATE wa_messages SET processing_status = 'en_cours', processing_error = NULL
     WHERE id = ? AND agency_id = ? AND direction = 'entrant'
       AND (processing_status IN ('recu', 'erreur')
            OR (processing_status = 'en_cours' AND updated_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE))`,
    [messageId, agencyId]
  );
  if (result.affectedRows !== 1) return null;
  const rows = await query(
    `SELECT m.*, c.contact_id, ct.phone AS contact_phone
     FROM wa_messages m
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = m.agency_id
     WHERE m.id = ? AND m.agency_id = ?`,
    [messageId, agencyId]
  );
  return rows[0] || null;
}

export async function finishInboundMessage(agencyId, messageId, { error } = {}) {
  await query(
    `UPDATE wa_messages SET processing_status = ?, processing_error = ?, processed_at = UTC_TIMESTAMP()
     WHERE id = ? AND agency_id = ?`,
    [error ? "erreur" : "traite", error ? String(error).slice(0, 255) : null, messageId, agencyId]
  );
}

// Télécharge les médias d'un message (WA-07) — idempotent : un média déjà
// stocké n'est pas retéléchargé.
export async function downloadMessageMedia(agencyId, messageId, accessToken) {
  const medias = await query(
    `SELECT id, meta_media_id, kind, mime_type, file_name FROM wa_media
     WHERE message_id = ? AND agency_id = ? AND storage_path IS NULL AND meta_media_id IS NOT NULL`,
    [messageId, agencyId]
  );
  for (const media of medias) {
    const info = await getMediaInfo(accessToken, media.meta_media_id);
    const buffer = await downloadMedia(accessToken, info.url);
    const mime = info.mime_type || media.mime_type;
    const month = new Date().toISOString().slice(0, 7);
    const relative = path.join(
      String(agencyId),
      month,
      `${messageId}-${media.id}.${extensionFor(mime, media.file_name)}`
    );
    const absolute = path.join(mediaRoot(), relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
    await query(
      `UPDATE wa_media SET storage_path = ?, mime_type = ?, size_bytes = ?, sha256 = ? WHERE id = ? AND agency_id = ?`,
      [
        relative.split(path.sep).join("/"),
        mime || null,
        buffer.length,
        crypto.createHash("sha256").update(buffer).digest("hex"),
        media.id,
        agencyId,
      ]
    );
  }
  return medias.length;
}

export async function markInboundRead(agencyId, metaMessageId) {
  const creds = await getAccountCredentials(agencyId);
  if (!creds?.accessToken) return;
  await markMessageAsRead(creds.accessToken, creds.phoneNumberId, metaMessageId);
}

// Transcription d'un vocal déjà téléchargé (WA-06) : audio ET texte conservés.
export async function transcribeMessageAudio(agencyId, messageId) {
  if (!transcriptionProvider()) return null;
  const [media] = await query(
    `SELECT storage_path, mime_type, file_name FROM wa_media
     WHERE message_id = ? AND agency_id = ? AND kind = 'audio' AND storage_path IS NOT NULL LIMIT 1`,
    [messageId, agencyId]
  );
  if (!media) return null;
  const buffer = await fs.readFile(path.join(mediaRoot(), media.storage_path));
  const result = await transcribeAudio({ buffer, mimeType: media.mime_type, fileName: media.file_name });
  if (result?.text) {
    await query(`UPDATE wa_messages SET transcription = ? WHERE id = ? AND agency_id = ?`, [result.text, messageId, agencyId]);
  }
  return result;
}

// Média d'un message pour l'agent IA (lecture des photos de documents et des
// reçus) : { mime, size, base64 } ou null.
export async function loadMessageMediaForAgent(agencyId, message) {
  const [media] = await query(
    `SELECT storage_path, mime_type, size_bytes FROM wa_media
     WHERE message_id = ? AND agency_id = ? AND storage_path IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [message.id, agencyId]
  );
  if (!media) return null;
  try {
    const buffer = await fs.readFile(path.join(mediaRoot(), media.storage_path));
    return { mime: String(media.mime_type || "").split(";")[0].trim(), size: buffer.length, base64: buffer.toString("base64") };
  } catch {
    return null;
  }
}

// Envois sortants : lib/whatsapp/outbound.js (ré-exportés ici pour le worker).
export { isServiceWindowOpen, sendConversationText, sendConversationImage } from "./outbound";

// Balayage (worker) : messages enregistrés mais jamais traités — Redis
// indisponible au moment du webhook, worker arrêté... Toutes agences
// confondues : chaque ligne porte son agency_id, repassé explicitement.
export async function listStaleInboundMessages(olderThanSeconds = 20, limit = 200) {
  return query(
    `SELECT id, agency_id FROM wa_messages -- agency-lint-ok: balayage worker, agence portée par chaque ligne
     WHERE direction = 'entrant'
       AND ((processing_status = 'recu' AND created_at < UTC_TIMESTAMP() - INTERVAL ${Number(olderThanSeconds)} SECOND)
            OR (processing_status = 'en_cours' AND updated_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE))
     ORDER BY id ASC LIMIT ${Number(limit)}`
  );
}
