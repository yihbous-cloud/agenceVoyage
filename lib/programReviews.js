import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Avis clients d'une fiche voyage — bloc « Preuves » (vague 2A, cahier §6.4
// et §10, CLAUDE.md §3centdixseptquadragies). Avis RÉELLEMENT reçus, saisis
// par l'équipe ; un avis n'est publiable qu'avec le consentement de son
// auteur (règle aussi imposée en base, chk_program_reviews_consent).

const validationError = (message) => Object.assign(new Error(message), { code: "VALIDATION" });

const REVIEW_LOCALES = ["ar", "fr", "en"];

export async function listReviewsForProgram(programId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT r.*, t.reference_code, t.departure_date
     FROM program_reviews r
     LEFT JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     WHERE r.program_id = ? AND r.agency_id = ?
     ORDER BY r.review_date DESC, r.id DESC`,
    [programId, agencyId]
  );
}

// Public (page statique : agence explicite) : avis publiés + note moyenne.
export async function listPublishedReviews(programId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const reviews = await query(
    `SELECT id, author_name, author_city, rating, body, locale, review_date
     FROM program_reviews
     WHERE program_id = ? AND agency_id = ? AND is_published = TRUE AND consent_given = TRUE
     ORDER BY review_date DESC, id DESC`,
    [programId, agencyId]
  );
  const average =
    reviews.length > 0 ? Math.round((reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length) * 10) / 10 : null;
  return { reviews, average, count: reviews.length };
}

async function normalizeReview(programId, data, agencyId) {
  const authorName = String(data.authorName || "").trim().slice(0, 120);
  const body = String(data.body || "").trim();
  const rating = Number(data.rating);
  const reviewDate = String(data.reviewDate || "").trim();
  if (!authorName) throw validationError("Le nom de l'auteur est requis.");
  if (!body) throw validationError("Le texte de l'avis est requis.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw validationError("La note doit être comprise entre 1 et 5.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate) || reviewDate > new Date().toISOString().slice(0, 10)) {
    throw validationError("Date de l'avis invalide.");
  }
  const consent = Boolean(data.consentGiven);
  const published = Boolean(data.isPublished);
  if (published && !consent) {
    throw validationError("Un avis ne peut être publié qu'avec le consentement de son auteur.");
  }
  let tripId = data.tripId ? Number(data.tripId) : null;
  if (tripId) {
    await assertOwned("trips", tripId, agencyId);
    const rows = await query(`SELECT program_id FROM trips WHERE id = ? AND agency_id = ?`, [tripId, agencyId]);
    if (Number(rows[0]?.program_id) !== Number(programId)) tripId = null;
  }
  return {
    trip_id: tripId,
    author_name: authorName,
    author_city: String(data.authorCity || "").trim().slice(0, 100) || null,
    rating,
    body,
    locale: REVIEW_LOCALES.includes(data.locale) ? data.locale : "ar",
    review_date: reviewDate,
    consent_given: consent,
    is_published: published,
  };
}

export async function createReview(programId, data, staffId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  const r = await normalizeReview(programId, data, agencyId);
  const result = await query(
    `INSERT INTO program_reviews (agency_id, program_id, trip_id, author_name, author_city, rating, body, locale,
       review_date, consent_given, is_published, created_by_staff_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agencyId,
      programId,
      r.trip_id,
      r.author_name,
      r.author_city,
      r.rating,
      r.body,
      r.locale,
      r.review_date,
      r.consent_given,
      r.is_published,
      staffId || null,
    ]
  );
  return result.insertId;
}

export async function updateReview(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_reviews", id, agencyId);
  const rows = await query(`SELECT program_id FROM program_reviews WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  const r = await normalizeReview(rows[0].program_id, data, agencyId);
  await query(
    `UPDATE program_reviews SET trip_id = ?, author_name = ?, author_city = ?, rating = ?, body = ?, locale = ?,
       review_date = ?, consent_given = ?, is_published = ?
     WHERE id = ? AND agency_id = ?`,
    [r.trip_id, r.author_name, r.author_city, r.rating, r.body, r.locale, r.review_date, r.consent_given, r.is_published, id, agencyId]
  );
}

export async function deleteReview(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_reviews", id, agencyId);
  await query(`DELETE FROM program_reviews WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

export async function programIdOfReview(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`SELECT program_id FROM program_reviews WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  return rows[0]?.program_id || null;
}
