import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { slugify } from "./programsAdmin";

export { slugify };

// --- Public ---

export async function listPublishedNews(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT * FROM news_posts WHERE is_published = TRUE AND agency_id = ? ORDER BY published_at DESC`,
    [agencyId]
  );
}

export async function getPublishedNewsBySlug(slug, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT * FROM news_posts WHERE slug = ? AND is_published = TRUE AND agency_id = ? LIMIT 1`,
    [slug, agencyId]
  );
  return rows[0] || null;
}

// --- Admin ---

export async function listAllNews() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM news_posts WHERE agency_id = ? ORDER BY created_at DESC`, [agencyId]);
}

export async function getNewsById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`SELECT * FROM news_posts WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  return rows[0] || null;
}

export async function createNews(data) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO news_posts
       (title, slug, excerpt, content, cover_image_url, is_published, published_at, meta_title, meta_description, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.slug,
      data.excerpt || null,
      data.content || null,
      data.coverImageUrl || null,
      !!data.isPublished,
      data.isPublished ? new Date() : null,
      data.metaTitle || null,
      data.metaDescription || null,
      agencyId,
    ]
  );
  return result.insertId;
}

export async function updateNews(id, data) {
  const agencyId = await resolveAgencyId();
  const existing = await getNewsById(id);
  if (!existing) {
    const err = new Error("Actualité introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
  const publishedAt =
    !existing.is_published && data.isPublished
      ? new Date()
      : existing.published_at;

  await query(
    `UPDATE news_posts SET
       title = ?, slug = ?, excerpt = ?, content = ?, cover_image_url = ?,
       is_published = ?, published_at = ?, meta_title = ?, meta_description = ?
     WHERE id = ? AND agency_id = ?`,
    [
      data.title,
      data.slug,
      data.excerpt || null,
      data.content || null,
      data.coverImageUrl || null,
      !!data.isPublished,
      publishedAt,
      data.metaTitle || null,
      data.metaDescription || null,
      id,
      agencyId,
    ]
  );
}

export async function deleteNews(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("news_posts", id, agencyId);
  await query(`DELETE FROM news_posts WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
