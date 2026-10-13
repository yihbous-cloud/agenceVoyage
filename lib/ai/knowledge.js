import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { SITE_PAGES, knowledgeForLocale, variantList, normalizeInternalPath } from "../editorial";

// Base de connaissances de l'agent (ia_knowledge, exigence 8.9) et file des
// questions sans réponse (ia_unanswered). Seules les fiches PUBLIÉES sont
// données à l'agent (lib/ai/agent.js, loadKnowledgeBlock).
// Vague 2B du référencement (migration 048) : c'est aussi la BANQUE DE
// QUESTIONS du site — une fiche publiée avec une « page du site » s'affiche
// sur /faq ou un pilier (une réponse = un endroit).

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
  const sitePage = SITE_PAGES.includes(data.sitePage) ? data.sitePage : null;
  const detailRaw = String(data.detailPath || "").trim();
  const detailPath = normalizeInternalPath(detailRaw);
  if (detailRaw && !detailPath) {
    const err = new Error("Le lien « En savoir plus » doit être un chemin du site commençant par « / » (ex. /guide/visa-omra).");
    err.code = "VALIDATION";
    throw err;
  }
  const item = {
    category: KNOWLEDGE_CATEGORIES.includes(data.category) ? data.category : "autre",
    question: question.slice(0, 500),
    question_ar: String(data.questionAr || "").trim().slice(0, 500) || null,
    variants: String(data.variants || "").trim() || null,
    answer_fr: answerFr || null,
    answer_ar: answerAr || null,
    status: data.status === "publie" ? "publie" : "brouillon",
    site_page: sitePage,
    site_sort: Math.max(0, Math.min(9999, Number.parseInt(data.siteSort, 10) || 0)),
    detail_path: detailPath,
  };
  // Affichée sur le site : la question et sa réponse doivent exister dans une
  // même langue (jamais de question française avec une réponse arabe seule).
  if (item.status === "publie" && sitePage && !knowledgeForLocale(item, "fr") && !knowledgeForLocale(item, "ar")) {
    const err = new Error("Pour l'afficher sur le site, saisissez la question et sa réponse dans une même langue.");
    err.code = "VALIDATION";
    throw err;
  }
  return item;
}

// Champs écrits par la création et la modification.
const WRITE_COLUMNS = ["category", "question", "question_ar", "variants", "answer_fr", "answer_ar", "status", "site_page", "site_sort", "detail_path"];
const INSERT_COLUMNS = WRITE_COLUMNS.join(", ");
const INSERT_VALUES = WRITE_COLUMNS.map(() => "?").join(", ");
const UPDATE_SET = WRITE_COLUMNS.map((c) => c + " = ?").join(", ");

// Banque de questions (site public, page statique : agence explicite) :
// questions publiées d'une page du site, dans la langue de la page. Une
// question absente dans cette langue n'est pas affichée.
export async function listSiteQuestions(page, explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT id, question, question_ar, variants, answer_fr, answer_ar, detail_path, verified_at, updated_at
     FROM ia_knowledge WHERE agency_id = ? AND status = 'publie' AND site_page = ?
     ORDER BY site_sort ASC, id ASC`,
    [agencyId, page]
  );
  return rows
    .map((row) => {
      const localized = knowledgeForLocale(row, locale);
      return localized
        ? { id: row.id, ...localized, variants: variantList(row.variants), detailPath: row.detail_path, updatedAt: row.updated_at }
        : null;
    })
    .filter(Boolean);
}

// Pages du site touchées par une fiche (avant et après modification).
export async function sitePagesOfKnowledge(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT site_page FROM ia_knowledge WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  return rows[0]?.site_page ? [rows[0].site_page] : [];
}

export async function createKnowledge(data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const f = clean(data);
  const result = await query(
    `INSERT INTO ia_knowledge (agency_id, ${INSERT_COLUMNS}, author_staff_id, verified_at)
     VALUES (?, ${INSERT_VALUES}, ?, CURDATE())`,
    [agencyId, ...WRITE_COLUMNS.map((c) => f[c]), staffId || null]
  );
  if (data.unansweredId) await markUnansweredHandled(data.unansweredId, result.insertId, agencyId);
  return result.insertId;
}

export async function updateKnowledge(id, data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_knowledge", id, agencyId);
  const f = clean(data);
  await query(
    `UPDATE ia_knowledge SET ${UPDATE_SET}, verified_at = CURDATE()
     WHERE id = ? AND agency_id = ?`,
    [...WRITE_COLUMNS.map((c) => f[c]), id, agencyId]
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
