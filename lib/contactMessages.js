import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// leadSource / leadSourceDetails : canal déjà classé côté serveur par la
// route (lib/leadSource.js), jamais pris tel quel du navigateur.
export async function createContactMessage(data) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO contact_messages (full_name, email, phone, subject, message, lead_source, lead_source_details, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.fullName,
      data.email,
      data.phone || null,
      data.subject || null,
      data.message,
      data.leadSource || null,
      data.leadSourceDetails ? JSON.stringify(data.leadSourceDetails) : null,
      agencyId,
    ]
  );
  return result.insertId;
}

export async function listContactMessages() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM contact_messages WHERE agency_id = ? ORDER BY created_at DESC`, [
    agencyId,
  ]);
}

export async function setContactMessageStatus(id, status) {
  const agencyId = await resolveAgencyId();
  await assertOwned("contact_messages", id, agencyId);
  await query(`UPDATE contact_messages SET status = ? WHERE id = ? AND agency_id = ?`, [
    status,
    id,
    agencyId,
  ]);
}

export async function deleteContactMessage(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("contact_messages", id, agencyId);
  await query(`DELETE FROM contact_messages WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
