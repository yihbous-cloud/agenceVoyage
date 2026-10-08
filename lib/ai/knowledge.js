import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";

// Base de connaissances de l'agent (ia_knowledge, exigence 8.9) et file des
// questions sans réponse (ia_unanswered). Seules les fiches PUBLIÉES sont
// données à l'agent (lib/ai/agent.js, loadKnowledgeBlock).

export const KNOWLEDGE_CATEGORIES = ["documents", "bagages", "vaccins", "paiement", "deroulement", "agence", "autre"];

export async function listKnowledge(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT k.*, su.full_name AS author_name,
       (k.verified_at IS NULL OR k.verified_at < CURDATE() - INTERVAL 6 MONTH) AS needs_review
     FROM ia_knowledge k LEFT JOIN staff_users su ON su.id = k.author_staff_id AND su.agency_id = k.agency_id
     WHERE k.agency_id = ? ORDER BY k.category, k.id`,
    [agencyId]
  );
  return rows.map((r) => ({ ...r, needs_review: Boolean(r.needs_review) }));
}

function clean(data) {
  const question = String(data.question || "").trim();
  if (!question) {
    const err = new Error("La question est obligatoire.");
    err.code = "VALIDATION";
    throw err;
  }
  const answerFr = String(data.answerFr || "").trim();
  const answerAr = String(data.answerAr || "").trim();
  if (data.status === "publie" && !answerFr && !answerAr) {
    const err = new Error("Une fiche publiée doit avoir au moins une réponse.");
    err.code = "VALIDATION";
    throw err;
  }
  return {
    category: KNOWLEDGE_CATEGORIES.includes(data.category) ? data.category : "autre",
    question: question.slice(0, 500),
    variants: String(data.variants || "").trim() || null,
    answer_fr: answerFr || null,
    answer_ar: answerAr || null,
    status: data.status === "publie" ? "publie" : "brouillon",
  };
}

export async function createKnowledge(data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const f = clean(data);
  const result = await query(
    `INSERT INTO ia_knowledge (agency_id, category, question, variants, answer_fr, answer_ar, status, author_staff_id, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [agencyId, f.category, f.question, f.variants, f.answer_fr, f.answer_ar, f.status, staffId || null]
  );
  if (data.unansweredId) await markUnansweredHandled(data.unansweredId, result.insertId, agencyId);
  return result.insertId;
}

export async function updateKnowledge(id, data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_knowledge", id, agencyId);
  const f = clean(data);
  await query(
    `UPDATE ia_knowledge SET category = ?, question = ?, variants = ?, answer_fr = ?, answer_ar = ?, status = ?, verified_at = CURDATE()
     WHERE id = ? AND agency_id = ?`,
    [f.category, f.question, f.variants, f.answer_fr, f.answer_ar, f.status, id, agencyId]
  );
}

export async function deleteKnowledge(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_knowledge", id, agencyId);
  await query(`DELETE FROM ia_knowledge WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

export async function listUnanswered(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(`SELECT * FROM ia_unanswered WHERE agency_id = ? AND handled = FALSE ORDER BY id DESC LIMIT 200`, [agencyId]);
}

export async function markUnansweredHandled(id, knowledgeId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_unanswered", id, agencyId);
  await query(`UPDATE ia_unanswered SET handled = TRUE, knowledge_id = ? WHERE id = ? AND agency_id = ?`, [knowledgeId || null, id, agencyId]);
}
