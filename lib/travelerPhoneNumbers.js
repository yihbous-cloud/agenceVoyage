import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Numéros de téléphone supplémentaires par voyageur (ex. contact
// d'urgence), en plus de phone/phone_whatsapp — voir CLAUDE.md.

export async function listPhoneNumbersForTraveler(travelerId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT id, phone_number FROM traveler_phone_numbers WHERE traveler_id = ? AND agency_id = ? ORDER BY id ASC`,
    [travelerId, agencyId]
  );
}

// Remplace l'ensemble des numéros du voyageur (même pattern que
// setHotelPreferencesForRegistration : purge puis réinsertion).
// phoneNumbers : string[] — entrées vides ignorées.
export async function setPhoneNumbersForTraveler(travelerId, phoneNumbers) {
  const agencyId = await resolveAgencyId();
  await assertOwned("travelers", travelerId, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM traveler_phone_numbers WHERE traveler_id = ? AND agency_id = ?`,
      [travelerId, agencyId]
    );
    for (const number of phoneNumbers || []) {
      const trimmed = (number || "").trim();
      if (!trimmed) continue;
      await connection.execute(
        `INSERT INTO traveler_phone_numbers (traveler_id, phone_number, agency_id) VALUES (?, ?, ?)`,
        [travelerId, trimmed, agencyId]
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
