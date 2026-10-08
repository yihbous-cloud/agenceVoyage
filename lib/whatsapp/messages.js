import { query } from "../db";

// Lectures de messages pour l'admin. Séparé de processing.js (worker, accès
// disque) pour que les pages n'entraînent pas le traçage de fichiers du
// stockage des médias dans le build.

// Journal des derniers messages pour l'écran Paramètres WhatsApp (recette Lot 0).
export async function listRecentMessages(agencyId, limit = 20) {
  return query(
    `SELECT m.id, m.direction, m.author, m.type, m.content, m.status, m.processing_status, m.processing_error,
       m.error_message, m.created_at, ct.phone, ct.profile_name,
       (SELECT COUNT(*) FROM wa_media md WHERE md.message_id = m.id AND md.agency_id = m.agency_id AND md.storage_path IS NOT NULL) AS media_stored
     FROM wa_messages m
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = m.agency_id
     WHERE m.agency_id = ?
     ORDER BY m.id DESC LIMIT ${Number(limit)}`,
    [agencyId]
  );
}
