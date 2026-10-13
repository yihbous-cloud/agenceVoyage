import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";

// NULL = ce type de chambre n'existe pas dans cet hôtel (distinct de 0 =
// existe mais aucune réservée) — voir migration 023 / CLAUDE.md.
function toNullableInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function listHotels() {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  // display_name : nom arabe si l'espace interne est en arabe (voir lib/hotelNames.js)
  return query(
    `SELECT h.*, ${hotelNameSql("h", locale)} AS display_name
     FROM hotels h WHERE h.agency_id = ? ORDER BY h.city ASC, h.name ASC`,
    [agencyId]
  );
}

// Photo réelle de l'hôtel (fiche voyage, balisage Hotel) : un envoi du site.
function photoUrlOrNull(value) {
  const url = String(value || "").trim();
  return url.startsWith("/uploads/") && !url.includes("..") ? url.slice(0, 500) : null;
}

export async function createHotel(data) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO hotels
       (name, name_arabic, city, country, star_rating, landmark_name, landmark_distance_m, contact_info,
        board_basis, reserved_rooms_simple, reserved_rooms_double, reserved_rooms_triple,
        reserved_rooms_quadruple, reserved_rooms_quintuple, photo_url, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.nameArabic?.trim() || null,
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
      photoUrlOrNull(data.photoUrl),
      agencyId,
    ]
  );
  return result.insertId;
}

export async function updateHotel(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("hotels", id, agencyId);
  await query(
    `UPDATE hotels SET name = ?, name_arabic = ?, city = ?, country = ?, star_rating = ?, landmark_name = ?, landmark_distance_m = ?, contact_info = ?,
       board_basis = ?, reserved_rooms_simple = ?, reserved_rooms_double = ?, reserved_rooms_triple = ?,
       reserved_rooms_quadruple = ?, reserved_rooms_quintuple = ?
     WHERE id = ? AND agency_id = ?`,
    [
      data.name,
      data.nameArabic?.trim() || null,
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
      agencyId,
    ]
  );
  // Photo (vague 2A) : modifiée seulement si le formulaire l'envoie.
  if (data.photoUrl !== undefined) {
    await query(`UPDATE hotels SET photo_url = ? WHERE id = ? AND agency_id = ?`, [photoUrlOrNull(data.photoUrl), id, agencyId]);
  }
}

export async function deleteHotel(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("hotels", id, agencyId);
  await query(`DELETE FROM hotels WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
