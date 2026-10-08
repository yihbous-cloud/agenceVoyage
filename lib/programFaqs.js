import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// --- Public ---

export async function listPublishedFaqsForProgram(programId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT id, question, answer FROM program_faqs
     WHERE program_id = ? AND agency_id = ? AND is_published = TRUE
     ORDER BY sort_order ASC, id ASC`,
    [programId, agencyId]
  );
}

// --- Admin ---

export async function listAllFaqsForProgram(programId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT * FROM program_faqs WHERE program_id = ? AND agency_id = ? ORDER BY sort_order ASC, id ASC`,
    [programId, agencyId]
  );
}

export async function createFaq(programId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  const result = await query(
    `INSERT INTO program_faqs (program_id, question, answer, sort_order, is_published, agency_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      programId,
      data.question,
      data.answer,
      data.sortOrder || 0,
      data.isPublished !== false,
      agencyId,
    ]
  );
  return result.insertId;
}

export async function updateFaq(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_faqs", id, agencyId);
  await query(
    `UPDATE program_faqs SET question = ?, answer = ?, sort_order = ?, is_published = ?
     WHERE id = ? AND agency_id = ?`,
    [data.question, data.answer, data.sortOrder || 0, data.isPublished !== false, id, agencyId]
  );
}

export async function deleteFaq(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_faqs", id, agencyId);
  await query(`DELETE FROM program_faqs WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
