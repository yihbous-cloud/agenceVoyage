import { query } from "./db";

export async function listHotels() {
  return query(`SELECT * FROM hotels ORDER BY city ASC, name ASC`);
}

export async function createHotel(data) {
  const result = await query(
    `INSERT INTO hotels
       (name, city, country, star_rating, landmark_name, landmark_distance_m, contact_info,
        board_basis, reserved_rooms_simple, reserved_rooms_double, reserved_rooms_triple,
        reserved_rooms_quadruple, reserved_rooms_quintuple)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.city,
      data.country || "Arabie Saoudite",
      data.starRating || null,
      data.landmarkName || null,
      data.landmarkDistanceM || null,
      data.contactInfo || null,
      data.boardBasis || "logement_seul",
      data.reservedRoomsSimple || 0,
      data.reservedRoomsDouble || 0,
      data.reservedRoomsTriple || 0,
      data.reservedRoomsQuadruple || 0,
      data.reservedRoomsQuintuple || 0,
    ]
  );
  return result.insertId;
}

export async function updateHotel(id, data) {
  await query(
    `UPDATE hotels SET name = ?, city = ?, country = ?, star_rating = ?, landmark_name = ?, landmark_distance_m = ?, contact_info = ?,
       board_basis = ?, reserved_rooms_simple = ?, reserved_rooms_double = ?, reserved_rooms_triple = ?,
       reserved_rooms_quadruple = ?, reserved_rooms_quintuple = ?
     WHERE id = ?`,
    [
      data.name,
      data.city,
      data.country || "Arabie Saoudite",
      data.starRating || null,
      data.landmarkName || null,
      data.landmarkDistanceM || null,
      data.contactInfo || null,
      data.boardBasis || "logement_seul",
      data.reservedRoomsSimple || 0,
      data.reservedRoomsDouble || 0,
      data.reservedRoomsTriple || 0,
      data.reservedRoomsQuadruple || 0,
      data.reservedRoomsQuintuple || 0,
      id,
    ]
  );
}

export async function deleteHotel(id) {
  await query(`DELETE FROM hotels WHERE id = ?`, [id]);
}
