import { query } from "./db";
import { slugify } from "./programsAdmin";

export { slugify };

// --- Public ---

export async function listPublishedNews() {
  return query(
    `SELECT * FROM news_posts WHERE is_published = TRUE ORDER BY published_at DESC`
  );
}

export async function getPublishedNewsBySlug(slug) {
  const rows = await query(
    `SELECT * FROM news_posts WHERE slug = ? AND is_published = TRUE LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

// --- Admin ---

export async function listAllNews() {
  return query(`SELECT * FROM news_posts ORDER BY created_at DESC`);
}

export async function getNewsById(id) {
  const rows = await query(`SELECT * FROM news_posts WHERE id = ?`, [id]);
  return rows[0] || null;
}

export async function createNews(data) {
  const result = await query(
    `INSERT INTO news_posts
       (title, slug, excerpt, content, cover_image_url, is_published, published_at, meta_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return result.insertId;
}

export async function updateNews(id, data) {
  const existing = await getNewsById(id);
  const publishedAt =
    !existing.is_published && data.isPublished
      ? new Date()
      : existing.published_at;

  await query(
    `UPDATE news_posts SET
       title = ?, slug = ?, excerpt = ?, content = ?, cover_image_url = ?,
       is_published = ?, published_at = ?, meta_title = ?, meta_description = ?
     WHERE id = ?`,
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
    ]
  );
}

export async function deleteNews(id) {
  await query(`DELETE FROM news_posts WHERE id = ?`, [id]);
}
