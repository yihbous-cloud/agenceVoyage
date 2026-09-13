import { query } from "./db";

export async function createContactMessage(data) {
  const result = await query(
    `INSERT INTO contact_messages (full_name, email, phone, subject, message)
     VALUES (?, ?, ?, ?, ?)`,
    [data.fullName, data.email, data.phone || null, data.subject || null, data.message]
  );
  return result.insertId;
}

export async function listContactMessages() {
  return query(`SELECT * FROM contact_messages ORDER BY created_at DESC`);
}

export async function setContactMessageStatus(id, status) {
  await query(`UPDATE contact_messages SET status = ? WHERE id = ?`, [status, id]);
}

export async function deleteContactMessage(id) {
  await query(`DELETE FROM contact_messages WHERE id = ?`, [id]);
}
