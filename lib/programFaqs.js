import { query } from "./db";

// --- Public ---

export async function listPublishedFaqsForProgram(programId) {
  return query(
    `SELECT id, question, answer FROM program_faqs
     WHERE program_id = ? AND is_published = TRUE
     ORDER BY sort_order ASC, id ASC`,
    [programId]
  );
}

// --- Admin ---

export async function listAllFaqsForProgram(programId) {
  return query(
    `SELECT * FROM program_faqs WHERE program_id = ? ORDER BY sort_order ASC, id ASC`,
    [programId]
  );
}

export async function createFaq(programId, data) {
  const result = await query(
    `INSERT INTO program_faqs (program_id, question, answer, sort_order, is_published)
     VALUES (?, ?, ?, ?, ?)`,
    [
      programId,
      data.question,
      data.answer,
      data.sortOrder || 0,
      data.isPublished !== false,
    ]
  );
  return result.insertId;
}

export async function updateFaq(id, data) {
  await query(
    `UPDATE program_faqs SET question = ?, answer = ?, sort_order = ?, is_published = ?
     WHERE id = ?`,
    [data.question, data.answer, data.sortOrder || 0, data.isPublished !== false, id]
  );
}

export async function deleteFaq(id) {
  await query(`DELETE FROM program_faqs WHERE id = ?`, [id]);
}
