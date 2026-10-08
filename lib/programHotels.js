import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned, assertAllOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";

// Hôtels par défaut d'un programme : fixés une fois à la création du
// programme. Ne s'auto-attachent plus à un voyage (retiré, voir CLAUDE.md
// §3duotrigies) — sert désormais de catalogue restreint proposé sur la page
// hébergement (§3quattertrigies) et de repli pour la préférence d'hôtel à
// l'inscription (§3quaterdecies).

export async function listDefaultHotelsForProgram(programId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT h.*, ${hotelNameSql("h", locale)} AS display_name
     FROM program_hotels ph
     JOIN hotels h ON h.id = ph.hotel_id
     WHERE ph.program_id = ? AND ph.agency_id = ? AND h.agency_id = ?
     ORDER BY h.city ASC, h.name ASC`,
    [programId, agencyId, agencyId]
  );
}

// Remplace l'ensemble des hôtels par défaut du programme (même pattern que
// setRolePermissions dans lib/permissions.js : purge puis réinsertion).
export async function setDefaultHotelsForProgram(programId, hotelIds) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  await assertAllOwned("hotels", hotelIds, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM program_hotels WHERE program_id = ? AND agency_id = ?`, [
      programId,
      agencyId,
    ]);
    if (hotelIds.length > 0) {
      const placeholders = hotelIds.map(() => "(?, ?, ?)").join(", ");
      const params = hotelIds.flatMap((hotelId) => [programId, hotelId, agencyId]);
      await connection.execute(
        `INSERT INTO program_hotels (program_id, hotel_id, agency_id) VALUES ${placeholders}`,
        params
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
