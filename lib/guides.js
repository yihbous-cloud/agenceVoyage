import { query } from "./db";
import { resolveAgencyId, assertOwned, assertAllOwned } from "./agencyContext";
import { applyTranslations, applyTranslation } from "./contentTranslations";
import { GUIDE_PILLARS, RESERVED_GUIDE_SLUGS, editorialSlug } from "./editorial";

// Guides de l'outil éditorial (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies) : articles de fond publiés sous /guide/<slug>,
// rattachés à un pilier, signés par un auteur et, pour un contenu religieux,
// relus par un référent. Contenu FR/AR selon le modèle de la vague 1B
// (content_locale + guide_translations).

const validationError = (message) => Object.assign(new Error(message), { code: "VALIDATION" });

const text = (value, max) => {
  const v = value == null ? "" : String(value).trim();
  return v === "" ? null : max ? v.slice(0, max) : v;
};

const LIST_COLUMNS = `g.id, g.slug, g.content_locale, g.pillar, g.title, g.excerpt, g.cover_image_url,
  g.author_id, g.published_at, g.updated_at, g.reviewed_at`;

// --- Public (pages statiques : agence et langue explicites) ---

export async function listPublishedGuides({ pillar, limit, excludeIds = [] } = {}, explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const params = [agencyId];
  let where = "g.agency_id = ? AND g.status = 'publie'";
  if (pillar) {
    where += " AND g.pillar = ?";
    params.push(pillar);
  }
  const excluded = excludeIds.filter(Boolean).map(Number);
  if (excluded.length > 0) {
    where += ` AND g.id NOT IN (${excluded.map(() => "?").join(", ")})`;
    params.push(...excluded);
  }
  const limitClause = limit ? "LIMIT " + Number(limit) : "";
  const rows = await query(
    `SELECT ${LIST_COLUMNS} FROM guides g WHERE ${where} -- agency-lint-ok: g.agency_id = ? dans ${where}
     ORDER BY g.published_at DESC, g.id DESC ${limitClause}`,
    params
  );
  return applyTranslations("guide", rows, locale, agencyId);
}

export async function getPublishedGuideBySlug(slug, explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT * FROM guides WHERE slug = ? AND agency_id = ? AND status = 'publie' LIMIT 1`,
    [slug, agencyId]
  );
  return rows[0] ? applyTranslation("guide", rows[0], locale, agencyId) : null;
}

export async function countPublishedGuides(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [row] = await query(`SELECT COUNT(*) AS n FROM guides WHERE agency_id = ? AND status = 'publie'`, [agencyId]);
  return Number(row?.n || 0);
}

// « Guides utiles » d'une fiche programme : les guides choisis pour ce
// programme, complétés par les plus récents de son pilier puis des conseils
// généraux (3 au plus).
export async function listGuidesForProgram(programId, guidePillar, explicitAgencyId, locale, max = 3) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const chosen = await query(
    `SELECT ${LIST_COLUMNS} FROM program_guides pg
     JOIN guides g ON g.id = pg.guide_id AND g.agency_id = pg.agency_id
     WHERE pg.program_id = ? AND pg.agency_id = ? AND g.status = 'publie'
     ORDER BY pg.sort_order ASC, g.published_at DESC LIMIT ${Number(max)}`,
    [programId, agencyId]
  );
  let rows = [...chosen];
  for (const pillar of [guidePillar, "general"]) {
    if (rows.length >= max || !pillar) continue;
    const exclude = rows.length > 0 ? "AND g.id NOT IN (" + rows.map(() => "?").join(", ") + ")" : "";
    const more = await query(
      `SELECT ${LIST_COLUMNS} FROM guides g
       WHERE g.agency_id = ? AND g.status = 'publie' AND g.pillar = ? ${exclude}
       ORDER BY g.published_at DESC LIMIT ${Number(max - rows.length)}`,
      [agencyId, pillar, ...rows.map((r) => r.id)]
    );
    rows = rows.concat(more);
  }
  return applyTranslations("guide", rows, locale, agencyId);
}

// --- Admin ---

export async function listAllGuides() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT g.id, g.slug, g.content_locale, g.pillar, g.title, g.status, g.is_religious, g.published_at,
       g.reviewed_at, g.updated_at, g.author_id, g.reviewer_id,
       a.name AS author_name, r.name AS reviewer_name,
       (SELECT COUNT(*) FROM program_guides pg WHERE pg.guide_id = g.id AND pg.agency_id = g.agency_id) AS program_count
     FROM guides g
     LEFT JOIN authors a ON a.id = g.author_id AND a.agency_id = g.agency_id
     LEFT JOIN authors r ON r.id = g.reviewer_id AND r.agency_id = g.agency_id
     WHERE g.agency_id = ? ORDER BY g.updated_at DESC`,
    [agencyId]
  );
}

export async function getGuideById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`SELECT * FROM guides WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  if (!rows[0]) return null;
  const links = await query(
    `SELECT program_id FROM program_guides WHERE guide_id = ? AND agency_id = ? ORDER BY sort_order, id`,
    [id, agencyId]
  );
  return { ...rows[0], program_ids: links.map((l) => l.program_id) };
}

async function normalizeGuide(data, agencyId) {
  const title = text(data.title, 200);
  if (!title) throw validationError("Le titre est requis.");
  const slug = editorialSlug(data.slug, title);
  if (!slug) throw validationError("Saisissez un slug (lettres latines, chiffres et tirets) : le titre ne permet pas d'en créer un.");
  if (RESERVED_GUIDE_SLUGS.includes(slug)) throw validationError(`Le slug « ${slug} » est réservé.`);
  const status = data.status === "publie" ? "publie" : "brouillon";
  const isReligious = Boolean(data.isReligious);
  const authorId = data.authorId ? Number(data.authorId) : null;
  const reviewerId = data.reviewerId ? Number(data.reviewerId) : null;
  if (authorId) await assertOwned("authors", authorId, agencyId);
  if (reviewerId) await assertOwned("authors", reviewerId, agencyId);
  const excerpt = text(data.excerpt, 500);
  const content = text(data.content);
  if (status === "publie") {
    if (!excerpt && !content) throw validationError("Un guide publié doit avoir un extrait ou un contenu.");
    // Règle du cahier (§13) : un contenu religieux n'est publié qu'après
    // relecture par un référent religieux.
    if (isReligious) {
      if (!reviewerId) throw validationError("Un guide religieux ne peut être publié sans relecteur référent religieux.");
      const [reviewer] = await query(`SELECT is_religious_referent FROM authors WHERE id = ? AND agency_id = ?`, [reviewerId, agencyId]);
      if (!reviewer?.is_religious_referent) {
        throw validationError("Le relecteur d'un guide religieux doit être un référent religieux (fiche auteur).");
      }
    }
  }
  const reviewedAt = String(data.reviewedAt || "").trim();
  if (reviewedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) || reviewedAt > new Date().toISOString().slice(0, 10))) {
    throw validationError("Date de relecture invalide.");
  }
  const cover = String(data.coverImageUrl || "").trim();
  if (cover && !/^\/uploads\/[\w./-]+$/.test(cover) && !/^https:\/\/[^\s]+$/.test(cover)) {
    throw validationError("Image de couverture invalide.");
  }
  return {
    slug,
    content_locale: data.contentLocale === "fr" ? "fr" : data.contentLocale === "ar" ? "ar" : null,
    pillar: GUIDE_PILLARS.includes(data.pillar) ? data.pillar : "general",
    title,
    excerpt,
    content,
    cover_image_url: cover || null,
    meta_title: text(data.metaTitle, 200),
    meta_description: text(data.metaDescription, 300),
    author_id: authorId,
    reviewer_id: reviewerId,
    is_religious: isReligious,
    status,
    reviewed_at: reviewedAt || null,
  };
}

const COLUMNS = [
  "slug",
  "pillar",
  "title",
  "excerpt",
  "content",
  "cover_image_url",
  "meta_title",
  "meta_description",
  "author_id",
  "reviewer_id",
  "is_religious",
  "status",
  "reviewed_at",
];
const INSERT_COLUMNS = COLUMNS.join(", ");
const INSERT_VALUES = COLUMNS.map(() => "?").join(", ");
const UPDATE_SET = COLUMNS.map((c) => c + " = ?").join(", ");

export async function createGuide(data) {
  const agencyId = await resolveAgencyId();
  const g = await normalizeGuide(data, agencyId);
  const result = await query(
    `INSERT INTO guides (agency_id, content_locale, published_at, ${INSERT_COLUMNS})
     VALUES (?, ?, ?, ${INSERT_VALUES})`,
    [agencyId, g.content_locale || "ar", g.status === "publie" ? new Date() : null, ...COLUMNS.map((c) => g[c])]
  );
  return result.insertId;
}

export async function updateGuide(id, data) {
  const agencyId = await resolveAgencyId();
  const existing = await getGuideById(id);
  if (!existing) throw Object.assign(new Error("Ressource introuvable"), { code: "NOT_FOUND" });
  const g = await normalizeGuide(data, agencyId);
  // Date de première publication conservée ; posée à la première publication.
  const publishedAt = g.status === "publie" ? existing.published_at || new Date() : existing.published_at;
  await query(
    `UPDATE guides SET content_locale = COALESCE(?, content_locale), published_at = ?, ${UPDATE_SET}
     WHERE id = ? AND agency_id = ?`,
    [g.content_locale, publishedAt, ...COLUMNS.map((c) => g[c]), id, agencyId]
  );
}

// Programmes dont la fiche affiche ce guide (« Guides utiles »).
export async function setGuidePrograms(guideId, programIds) {
  const agencyId = await resolveAgencyId();
  await assertOwned("guides", guideId, agencyId);
  const ids = [...new Set((programIds || []).filter(Boolean).map(Number))];
  await assertAllOwned("programs", ids, agencyId);
  const before = await query(`SELECT program_id FROM program_guides WHERE guide_id = ? AND agency_id = ?`, [guideId, agencyId]);
  await query(`DELETE FROM program_guides WHERE guide_id = ? AND agency_id = ?`, [guideId, agencyId]);
  for (const programId of ids) {
    await query(`INSERT INTO program_guides (agency_id, program_id, guide_id, sort_order) VALUES (?, ?, ?, 0)`, [
      agencyId,
      programId,
      guideId,
    ]);
  }
  // Fiches concernées (ajoutées ou retirées) : à rafraîchir.
  return [...new Set([...before.map((r) => r.program_id), ...ids])];
}

export async function deleteGuide(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("guides", id, agencyId);
  await query(`DELETE FROM guides WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
