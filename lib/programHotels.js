import { query, getPool } from "./db";

// Hôtels par défaut d'un programme : fixés une fois à la création du
// programme, auto-attachés à chaque nouveau voyage créé sous ce programme
// (voir createTrip dans lib/programsAdmin.js et CLAUDE.md).

export async function listDefaultHotelsForProgram(programId) {
  return query(
    `SELECT h.*
     FROM program_hotels ph
     JOIN hotels h ON h.id = ph.hotel_id
     WHERE ph.program_id = ?
     ORDER BY h.city ASC, h.name ASC`,
    [programId]
  );
}

// Remplace l'ensemble des hôtels par défaut du programme (même pattern que
// setRolePermissions dans lib/permissions.js : purge puis réinsertion).
export async function setDefaultHotelsForProgram(programId, hotelIds) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM program_hotels WHERE program_id = ?`, [programId]);
    if (hotelIds.length > 0) {
      const placeholders = hotelIds.map(() => "(?, ?)").join(", ");
      const params = hotelIds.flatMap((hotelId) => [programId, hotelId]);
      await connection.execute(
        `INSERT INTO program_hotels (program_id, hotel_id) VALUES ${placeholders}`,
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
