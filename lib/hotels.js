import { query } from "./db";

export async function listHotels() {
  return query(`SELECT * FROM hotels ORDER BY city ASC, name ASC`);
}

export async function createHotel(data) {
  const result = await query(
    `INSERT INTO hotels (name, city, country, star_rating, landmark_name, landmark_distance_m, contact_info)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.city,
      data.country || "Arabie Saoudite",
      data.starRating || null,
      data.landmarkName || null,
      data.landmarkDistanceM || null,
      data.contactInfo || null,
    ]
  );
  return result.insertId;
}

export async function updateHotel(id, data) {
  await query(
    `UPDATE hotels SET name = ?, city = ?, country = ?, star_rating = ?, landmark_name = ?, landmark_distance_m = ?, contact_info = ?
     WHERE id = ?`,
    [
      data.name,
      data.city,
      data.country || "Arabie Saoudite",
      data.starRating || null,
      data.landmarkName || null,
      data.landmarkDistanceM || null,
      data.contactInfo || null,
      id,
    ]
  );
}

export async function deleteHotel(id) {
  await query(`DELETE FROM hotels WHERE id = ?`, [id]);
}
