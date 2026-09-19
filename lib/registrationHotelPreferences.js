import { query, getPool } from "./db";

// Un voyageur Omra passe par plusieurs villes (Mecque + Médine) : une
// préférence hôtel par ville plutôt qu'une seule pour toute l'inscription
// (registrations.preferred_hotel_id, dépréciée — voir CLAUDE.md).

export async function listHotelPreferencesForRegistration(registrationId) {
  return query(
    `SELECT rhp.city, rhp.hotel_id, h.name AS hotel_name
     FROM registration_hotel_preferences rhp
     JOIN hotels h ON h.id = rhp.hotel_id
     WHERE rhp.registration_id = ?
     ORDER BY rhp.city ASC`,
    [registrationId]
  );
}

// Remplace l'ensemble des préférences de l'inscription (même pattern que
// setRolePermissions/setDefaultHotelsForProgram : purge puis réinsertion).
// preferences : [{ city, hotelId }] — une entrée sans hotelId est ignorée.
export async function setHotelPreferencesForRegistration(registrationId, preferences) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM registration_hotel_preferences WHERE registration_id = ?`,
      [registrationId]
    );
    for (const pref of preferences || []) {
      if (!pref.hotelId) continue;
      await connection.execute(
        `INSERT INTO registration_hotel_preferences (registration_id, city, hotel_id)
         VALUES (?, ?, ?)`,
        [registrationId, pref.city, pref.hotelId]
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
  return query(
    `SELECT rhp.registration_id, rhp.city, rhp.hotel_id, h.name AS hotel_name
     FROM registration_hotel_preferences rhp
     JOIN registrations r ON r.id = rhp.registration_id
     JOIN hotels h ON h.id = rhp.hotel_id
     WHERE r.trip_id = ?`,
    [tripId]
  );
}
