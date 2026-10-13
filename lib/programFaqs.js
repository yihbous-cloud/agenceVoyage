import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { applyTranslations, setTranslations } from "./contentTranslations";

// Une FAQ est saisie dans la langue principale de son programme ; son autre
// langue va dans program_faq_translations (vague 1B du référencement).
async function programLocaleOfFaq(faqId, agencyId) {
  const rows = await query(
    `SELECT p.content_locale FROM program_faqs f
     JOIN programs p ON p.id = f.program_id AND p.agency_id = f.agency_id
     WHERE f.id = ? AND f.agency_id = ?`,
    [faqId, agencyId]
  );
  return rows[0]?.content_locale || "ar";
}

// FAQ d'un programme sans version complète (question + réponse) dans
// `locale` : bloque le changement de langue principale du programme.
export async function countFaqsMissingLocale(programId, locale, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT COUNT(*) AS n FROM program_faqs f
     LEFT JOIN program_faq_translations t
       ON t.faq_id = f.id AND t.locale = ? AND t.agency_id = f.agency_id
     WHERE f.program_id = ? AND f.agency_id = ?
       AND (t.id IS NULL OR COALESCE(TRIM(t.question), '') = '' OR COALESCE(TRIM(t.answer), '') = '')`,
    [locale, programId, agencyId]
  );
  return Number(rows[0]?.n || 0);
}

// Langue principale du programme passée de `fromLocale` à `toLocale` : ses FAQ
// suivent. La version `toLocale` devient le texte principal, l'ancien texte
// devient la version `fromLocale` (les deux langues sont conservées).
// Appeler countFaqsMissingLocale avant : une FAQ sans version complète est
// laissée telle quelle.
export async function swapFaqsContentLocale(programId, fromLocale, toLocale, explicitAgencyId) {
  if (fromLocale === toLocale) return;
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT f.id, f.question, f.answer, t.question AS tr_question, t.answer AS tr_answer
       FROM program_faqs f
       JOIN program_faq_translations t ON t.faq_id = f.id AND t.locale = ? AND t.agency_id = f.agency_id
       WHERE f.program_id = ? AND f.agency_id = ?
       FOR UPDATE`,
      [toLocale, programId, agencyId]
    );
    for (const row of rows) {
      if (!String(row.tr_question || "").trim() || !String(row.tr_answer || "").trim()) continue;
      await connection.execute(
        `UPDATE program_faqs SET question = ?, answer = ? WHERE id = ? AND agency_id = ?`,
        [row.tr_question, row.tr_answer, row.id, agencyId]
      );
      await connection.execute(
        `DELETE FROM program_faq_translations WHERE faq_id = ? AND locale = ? AND agency_id = ?`,
        [row.id, toLocale, agencyId]
      );
      await connection.execute(
        `INSERT INTO program_faq_translations (agency_id, faq_id, locale, question, answer)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE question = VALUES(question), answer = VALUES(answer)`,
        [agencyId, row.id, fromLocale, row.question, row.answer]
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// --- Public ---

// locale (optionnel) : question/réponse dans la langue de la page quand une
// traduction existe ; une FAQ suit la langue principale de son programme.
export async function listPublishedFaqsForProgram(programId, explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT f.id, f.question, f.answer, p.content_locale
     FROM program_faqs f
     JOIN programs p ON p.id = f.program_id AND p.agency_id = f.agency_id
     WHERE f.program_id = ? AND f.agency_id = ? AND f.is_published = TRUE
     ORDER BY f.sort_order ASC, f.id ASC`,
    [programId, agencyId]
  );
  return applyTranslations("faq", rows, locale, agencyId);
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
  if (data.translations !== undefined) {
    await setTranslations("faq", result.insertId, data.translations, {
      baseLocale: await programLocaleOfFaq(result.insertId, agencyId),
    }, agencyId);
  }
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
  if (data.translations !== undefined) {
    await setTranslations("faq", id, data.translations, { baseLocale: await programLocaleOfFaq(id, agencyId) }, agencyId);
  }
}

export async function deleteFaq(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_faqs", id, agencyId);
  await query(`DELETE FROM program_faqs WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
