import { query } from "./db";

// Offres de restauration par voyage (liste répétable) — même pattern que
// lib/programFaqs.js, voir CLAUDE.md.

// --- Public ---

export async function listPublishedMealOffersForTrip(tripId) {
  return query(
    `SELECT id, title, description FROM trip_meal_offers
     WHERE trip_id = ? AND is_published = TRUE
     ORDER BY sort_order ASC, id ASC`,
    [tripId]
  );
}

// --- Admin ---

export async function listAllMealOffersForTrip(tripId) {
  return query(
    `SELECT * FROM trip_meal_offers WHERE trip_id = ? ORDER BY sort_order ASC, id ASC`,
    [tripId]
  );
}

export async function createMealOffer(tripId, data) {
  const result = await query(
    `INSERT INTO trip_meal_offers (trip_id, title, description, sort_order, is_published)
     VALUES (?, ?, ?, ?, ?)`,
    [
      tripId,
      data.title,
      data.description || null,
      data.sortOrder || 0,
      data.isPublished !== false,
    ]
  );
  return result.insertId;
}

export async function updateMealOffer(id, data) {
  await query(
    `UPDATE trip_meal_offers SET title = ?, description = ?, sort_order = ?, is_published = ?
     WHERE id = ?`,
    [data.title, data.description || null, data.sortOrder || 0, data.isPublished !== false, id]
  );
}

export async function deleteMealOffer(id) {
  await query(`DELETE FROM trip_meal_offers WHERE id = ?`, [id]);
}
