import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Auteurs et relecteurs des guides (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies). Rôle, expérience et statut de référent religieux
// sont affichés sur les guides (E-E-A-T, cahier §13).

const validationError = (message) => Object.assign(new Error(message), { code: "VALIDATION" });

const text = (value, max) => {
  const v = value == null ? "" : String(value).trim();
  return v === "" ? null : v.slice(0, max);
};

function photoUrl(value, agencyId) {
  const url = String(value || "").trim();
  if (!url) return null;
  const ownUpload = url.startsWith(`/uploads/agencies/${agencyId}/`) || /^\/uploads\/(agency|programs)\//.test(url);
  if (!/^\/uploads\/[\w./-]+$/.test(url) || url.includes("..") || !ownUpload) {
    throw validationError("Photo invalide : envoyez une image.");
  }
  return url;
}

async function normalizeAuthor(data, agencyId) {
  const name = text(data.name, 150);
  if (!name) throw validationError("Le nom de l'auteur est requis.");
  const trips = data.tripsSupervised === "" || data.tripsSupervised == null ? null : Number(data.tripsSupervised);
  if (trips !== null && (!Number.isInteger(trips) || trips < 0)) {
    throw validationError("Le nombre de voyages encadrés doit être un entier positif.");
  }
  const staffUserId = data.staffUserId ? Number(data.staffUserId) : null;
  if (staffUserId) await assertOwned("staff_users", staffUserId, agencyId);
  return {
    name,
    name_ar: text(data.nameAr, 150),
    job_title_fr: text(data.jobTitleFr, 150),
    job_title_ar: text(data.jobTitleAr, 150),
    bio_fr: text(data.bioFr, 5000),
    bio_ar: text(data.bioAr, 5000),
    photo_url: photoUrl(data.photoUrl, agencyId),
    trips_supervised: trips,
    is_religious_referent: Boolean(data.isReligiousReferent),
    staff_user_id: staffUserId,
    is_active: data.isActive === undefined ? true : Boolean(data.isActive),
  };
}

const COLUMNS = [
  "name",
  "name_ar",
  "job_title_fr",
  "job_title_ar",
  "bio_fr",
  "bio_ar",
  "photo_url",
  "trips_supervised",
  "is_religious_referent",
  "staff_user_id",
  "is_active",
];
const INSERT_COLUMNS = COLUMNS.join(", ");
const INSERT_VALUES = COLUMNS.map(() => "?").join(", ");
const UPDATE_SET = COLUMNS.map((c) => c + " = ?").join(", ");

export async function listAuthors() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT a.*, su.full_name AS staff_name,
       (SELECT COUNT(*) FROM guides g WHERE g.agency_id = a.agency_id AND (g.author_id = a.id OR g.reviewer_id = a.id)) AS guide_count
     FROM authors a
     LEFT JOIN staff_users su ON su.id = a.staff_user_id AND su.agency_id = a.agency_id
     WHERE a.agency_id = ? ORDER BY a.is_active DESC, a.name ASC`,
    [agencyId]
  );
}

// Public (page statique : agence explicite).
export async function getAuthorsByIds(ids, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const unique = [...new Set((ids || []).filter(Boolean).map(Number))];
  if (unique.length === 0) return {};
  const rows = await query(
    `SELECT id, name, name_ar, job_title_fr, job_title_ar, bio_fr, bio_ar, photo_url, trips_supervised, is_religious_referent
     FROM authors WHERE id IN (${unique.map(() => "?").join(", ")}) AND agency_id = ?`,
    [...unique, agencyId]
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

export async function createAuthor(data) {
  const agencyId = await resolveAgencyId();
  const a = await normalizeAuthor(data, agencyId);
  const result = await query(
    `INSERT INTO authors (agency_id, ${INSERT_COLUMNS}) VALUES (?, ${INSERT_VALUES})`,
    [agencyId, ...COLUMNS.map((c) => a[c])]
  );
  return result.insertId;
}

export async function updateAuthor(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("authors", id, agencyId);
  const a = await normalizeAuthor(data, agencyId);
  if (!a.is_religious_referent) {
    // Un relecteur de guide religieux publié doit rester référent.
    const [used] = await query(
      `SELECT COUNT(*) AS n FROM guides WHERE agency_id = ? AND reviewer_id = ? AND is_religious = TRUE AND status = 'publie'`,
      [agencyId, id]
    );
    if (Number(used.n) > 0) {
      throw validationError("Cet auteur relit des guides religieux publiés : il doit rester référent religieux.");
    }
  }
  await query(
    `UPDATE authors SET ${UPDATE_SET} WHERE id = ? AND agency_id = ?`,
    [...COLUMNS.map((c) => a[c]), id, agencyId]
  );
}

// Guides publiés signés ou relus par cet auteur (pages à rafraîchir).
export async function listGuideSlugsOfAuthor(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT slug FROM guides WHERE agency_id = ? AND status = 'publie' AND (author_id = ? OR reviewer_id = ?)`,
    [agencyId, id, id]
  );
  return rows.map((r) => r.slug);
}

export async function deleteAuthor(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("authors", id, agencyId);
  const [used] = await query(
    `SELECT COUNT(*) AS n FROM guides WHERE agency_id = ? AND reviewer_id = ? AND is_religious = TRUE AND status = 'publie'`,
    [agencyId, id]
  );
  if (Number(used.n) > 0) {
    throw validationError("Cet auteur relit des guides religieux publiés : changez d'abord leur relecteur.");
  }
  await query(`DELETE FROM authors WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
