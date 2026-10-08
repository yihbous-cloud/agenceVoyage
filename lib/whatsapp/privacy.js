import fs from "node:fs/promises";
import path from "node:path";
import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { getOpsSettings } from "./ops";

// Données personnelles (CNDP, loi 09-08 — NF-13, §8.17 « Données ») :
// purge automatique paramétrable, export et suppression des données d'un
// contact sur demande. ⚠️ Accès disque : à n'importer que depuis des routes
// API ou le worker, jamais depuis une page (Turbopack tracerait le projet).

function mediaRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.env.WA_MEDIA_DIR || "storage/wa-media");
}

async function removeFile(relative) {
  if (!relative) return false;
  const root = mediaRoot();
  const absolute = path.resolve(/* turbopackIgnore: true */ root, relative);
  if (!absolute.startsWith(root)) return false; // jamais hors du dossier des médias
  try {
    await fs.unlink(/* turbopackIgnore: true */ absolute);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}

// Supprime les fichiers puis neutralise les lignes wa_media (la trace
// « document reçu le ... » reste, le contenu disparaît).
async function purgeMediaRows(agencyId, rows) {
  let files = 0;
  for (const m of rows) {
    if (await removeFile(m.storage_path)) files += 1;
    await query(`UPDATE wa_media SET storage_path = NULL, meta_media_id = NULL, purge_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [m.id, agencyId]);
  }
  return files;
}

// Purge d'une agence (worker, chaque nuit) — seulement si la direction l'a
// activée après avoir validé les durées de conservation.
export async function purgeAgencyData(explicitAgencyId, { dryRun = false } = {}) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const s = await getOpsSettings(agencyId);
  // 1. Copies de documents (passeport, CIN, photo, reçu) : X jours après le
  //    retour du dernier voyage du voyageur (ou X jours après réception si le
  //    contact n'a jamais été inscrit).
  const documents = await query(
    `SELECT md.id, md.storage_path FROM wa_media md
     JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE md.agency_id = ? AND md.purge_at IS NULL AND md.doc_type IN ('passeport', 'cin', 'photo', 'recu')
       AND (
         (ct.traveler_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM registrations g JOIN trips t ON t.id = g.trip_id AND t.agency_id = g.agency_id
            WHERE g.traveler_id = ct.traveler_id AND g.agency_id = ct.agency_id AND g.status <> 'annule'
              AND COALESCE(t.return_date, t.departure_date) >= CURDATE() - INTERVAL ? DAY))
         OR (ct.traveler_id IS NULL AND md.created_at < UTC_TIMESTAMP() - INTERVAL ? DAY)
       )`,
    [agencyId, s.retention_documents_days_after_trip, s.retention_documents_days_after_trip]
  );
  // 2. Autres médias (vocaux, images...) au-delà de la durée générale.
  const media = await query(
    `SELECT id, storage_path FROM wa_media WHERE agency_id = ? AND purge_at IS NULL
       AND (doc_type IS NULL OR doc_type = 'autre') AND created_at < UTC_TIMESTAMP() - INTERVAL ? DAY`,
    [agencyId, s.retention_media_days]
  );
  // 3. Conversations résolues sans activité depuis X mois (messages, médias,
  //    journaux IA associés).
  const conversations = await query(
    `SELECT c.id FROM wa_conversations c WHERE c.agency_id = ? AND c.status = 'resolu'
       AND COALESCE(c.resolved_at, c.updated_at) < UTC_TIMESTAMP() - INTERVAL ? MONTH
       AND NOT EXISTS (SELECT 1 FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
         AND m.created_at >= UTC_TIMESTAMP() - INTERVAL ? MONTH)`,
    [agencyId, s.retention_conversations_months, s.retention_conversations_months]
  );
  const [logs] = await query(`SELECT COUNT(*) AS n FROM ia_logs WHERE agency_id = ? AND created_at < UTC_TIMESTAMP() - INTERVAL ? DAY`, [
    agencyId,
    s.retention_ia_logs_days,
  ]);
  const plan = { documents: documents.length, media: media.length, conversations: conversations.length, iaLogs: Number(logs.n) };
  if (dryRun) return { dryRun: true, ...plan };

  const files = (await purgeMediaRows(agencyId, documents)) + (await purgeMediaRows(agencyId, media));
  for (const { id } of conversations) await deleteConversations(agencyId, [id]);
  await query(`DELETE FROM ia_logs WHERE agency_id = ? AND created_at < UTC_TIMESTAMP() - INTERVAL ? DAY`, [agencyId, s.retention_ia_logs_days]);
  const result = `${plan.documents} document(s), ${plan.media} média(s), ${plan.conversations} conversation(s), ${plan.iaLogs} journal(aux) IA — ${files} fichier(s) supprimé(s)`;
  await query(`UPDATE wa_ops_settings SET last_purge_at = UTC_TIMESTAMP(), last_purge_result = ? WHERE agency_id = ?`, [result.slice(0, 255), agencyId]);
  return { ...plan, files, result };
}

async function deleteConversations(agencyId, conversationIds) {
  if (!conversationIds.length) return;
  const marks = conversationIds.map(() => "?").join(", ");
  const files = await query(
    `SELECT md.storage_path FROM wa_media md JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
     WHERE md.agency_id = ? AND m.conversation_id IN (${marks})`,
    [agencyId, ...conversationIds]
  );
  for (const f of files) await removeFile(f.storage_path);
  // Journaux IA et questions sans réponse : ils contiennent des extraits des échanges.
  await query(`DELETE FROM ia_logs WHERE agency_id = ? AND conversation_id IN (${marks})`, [agencyId, ...conversationIds]);
  await query(`DELETE FROM ia_unanswered WHERE agency_id = ? AND conversation_id IN (${marks})`, [agencyId, ...conversationIds]);
  await query(`DELETE FROM wa_conversations WHERE agency_id = ? AND id IN (${marks})`, [agencyId, ...conversationIds]);
}

// Export complet des données d'un contact (droit d'accès) : JSON.
export async function exportContactData(contactId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_contacts", contactId, agencyId);
  const [contact] = await query(
    `SELECT id, phone, profile_name, language, source, stage, qualification, marketing_opt_in, blocked, last_inbound_at, created_at
     FROM wa_contacts WHERE id = ? AND agency_id = ?`,
    [contactId, agencyId]
  );
  const consents = await query(`SELECT action, source, text_shown, created_at FROM wa_consents WHERE contact_id = ? AND agency_id = ? ORDER BY id`, [
    contactId,
    agencyId,
  ]);
  const conversations = await query(`SELECT id, status, opened_at, resolved_at FROM wa_conversations WHERE contact_id = ? AND agency_id = ? ORDER BY id`, [
    contactId,
    agencyId,
  ]);
  for (const c of conversations) {
    c.messages = await query(
      `SELECT m.created_at, m.direction, m.author, m.type, m.content, m.transcription, m.status,
         (SELECT GROUP_CONCAT(CONCAT(md.kind, IF(md.doc_type IS NULL, '', CONCAT(' (', md.doc_type, ')')), IF(md.purge_at IS NULL, '', ' — supprimé')) SEPARATOR ', ')
            FROM wa_media md WHERE md.message_id = m.id AND md.agency_id = m.agency_id) AS media
       FROM wa_messages m WHERE m.conversation_id = ? AND m.agency_id = ? AND m.is_private_note = FALSE AND m.type <> 'note'
       ORDER BY m.id`,
      [c.id, agencyId]
    );
  }
  const campaigns = await query(
    `SELECT cp.name, r.status, r.sent_at FROM wa_campaign_recipients r JOIN wa_campaigns cp ON cp.id = r.campaign_id AND cp.agency_id = r.agency_id
     WHERE r.contact_id = ? AND r.agency_id = ? ORDER BY r.id`,
    [contactId, agencyId]
  );
  return { exportedAt: new Date().toISOString(), contact, consents, conversations, campaigns };
}

// Suppression des données WhatsApp d'un contact (droit d'opposition /
// effacement). Le dossier de voyage du CRM (inscription, paiements,
// passeport saisi) n'est PAS touché : obligations comptables et légales.
export async function deleteContactData(contactId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_contacts", contactId, agencyId);
  const conversations = await query(`SELECT id FROM wa_conversations WHERE contact_id = ? AND agency_id = ?`, [contactId, agencyId]);
  await deleteConversations(agencyId, conversations.map((c) => c.id));
  await query(`DELETE FROM wa_contacts WHERE id = ? AND agency_id = ?`, [contactId, agencyId]);
  return { conversations: conversations.length };
}
