import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Offres de restauration par voyage (liste répétable) — même pattern que
// lib/programFaqs.js, voir CLAUDE.md.

// --- Public ---

export async function listPublishedMealOffersForTrip(tripId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT id, title, description FROM trip_meal_offers
     WHERE trip_id = ? AND agency_id = ? AND is_published = TRUE
     ORDER BY sort_order ASC, id ASC`,
    [tripId, agencyId]
  );
}

// --- Admin ---

export async function listAllMealOffersForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT * FROM trip_meal_offers WHERE trip_id = ? AND agency_id = ? ORDER BY sort_order ASC, id ASC`,
    [tripId, agencyId]
  );
}

export async function createMealOffer(tripId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  const result = await query(
    `INSERT INTO trip_meal_offers (trip_id, title, description, sort_order, is_published, agency_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      tripId,
      data.title,
      data.description || null,
      data.sortOrder || 0,
      data.isPublished !== false,
      agencyId,
    ]
  );
  return result.insertId;
}

export async function updateMealOffer(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_meal_offers", id, agencyId);
  await query(
    `UPDATE trip_meal_offers SET title = ?, description = ?, sort_order = ?, is_published = ?
     WHERE id = ? AND agency_id = ?`,
    [data.title, data.description || null, data.sortOrder || 0, data.isPublished !== false, id, agencyId]
  );
}

export async function deleteMealOffer(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_meal_offers", id, agencyId);
  await query(`DELETE FROM trip_meal_offers WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
