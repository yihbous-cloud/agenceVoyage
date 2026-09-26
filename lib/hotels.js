import { query } from "./db";

// NULL = ce type de chambre n'existe pas dans cet hôtel (distinct de 0 =
// existe mais aucune réservée) — voir migration 023 / CLAUDE.md.
function toNullableInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

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
      toNullableInt(data.reservedRoomsSimple),
      toNullableInt(data.reservedRoomsDouble),
      toNullableInt(data.reservedRoomsTriple),
      toNullableInt(data.reservedRoomsQuadruple),
      toNullableInt(data.reservedRoomsQuintuple),
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
      toNullableInt(data.reservedRoomsSimple),
      toNullableInt(data.reservedRoomsDouble),
      toNullableInt(data.reservedRoomsTriple),
      toNullableInt(data.reservedRoomsQuadruple),
      toNullableInt(data.reservedRoomsQuintuple),
      id,
    ]
  );
}

export async function deleteHotel(id) {
  await query(`DELETE FROM hotels WHERE id = ?`, [id]);
}
