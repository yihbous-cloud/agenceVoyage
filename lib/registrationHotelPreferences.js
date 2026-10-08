import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned, assertAllOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";

// Un voyageur Omra passe par plusieurs villes (Mecque + Médine) : une
// préférence hôtel par ville plutôt qu'une seule pour toute l'inscription
// (registrations.preferred_hotel_id, dépréciée — voir CLAUDE.md).

export async function listHotelPreferencesForRegistration(registrationId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT rhp.city, rhp.hotel_id, ${hotelNameSql("h", locale)} AS hotel_name
     FROM registration_hotel_preferences rhp
     JOIN hotels h ON h.id = rhp.hotel_id
     WHERE rhp.registration_id = ? AND rhp.agency_id = ?
     ORDER BY rhp.city ASC`,
    [registrationId, agencyId]
  );
}

// Remplace l'ensemble des préférences de l'inscription (même pattern que
// setRolePermissions/setDefaultHotelsForProgram : purge puis réinsertion).
// preferences : [{ city, hotelId }] — une entrée sans hotelId est ignorée.
export async function setHotelPreferencesForRegistration(registrationId, preferences) {
  const agencyId = await resolveAgencyId();
  await assertOwned("registrations", registrationId, agencyId);
  await assertAllOwned(
    "hotels",
    (preferences || []).filter((p) => p.hotelId).map((p) => p.hotelId),
    agencyId
  );
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM registration_hotel_preferences WHERE registration_id = ? AND agency_id = ?`,
      [registrationId, agencyId]
    );
    for (const pref of preferences || []) {
      if (!pref.hotelId) continue;
      await connection.execute(
        `INSERT INTO registration_hotel_preferences (registration_id, city, hotel_id, agency_id)
         VALUES (?, ?, ?, ?)`,
        [registrationId, pref.city, pref.hotelId, agencyId]
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Toutes les préférences de tous les voyageurs non affectés d'un voyage, en
// un seul aller-retour — évite le N+1 dans listUnassignedRegistrations.
export async function listHotelPreferencesForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT rhp.registration_id, rhp.city, rhp.hotel_id, ${hotelNameSql("h", locale)} AS hotel_name
     FROM registration_hotel_preferences rhp
     JOIN registrations r ON r.id = rhp.registration_id
     JOIN hotels h ON h.id = rhp.hotel_id
     WHERE r.trip_id = ? AND r.agency_id = ? AND rhp.agency_id = ?`,
    [tripId, agencyId, agencyId]
  );
}
