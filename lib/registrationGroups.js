import { query } from "./db";

// Un groupe lie plusieurs inscriptions du même voyage (binôme/couple,
// famille, groupe d'amis) — voir CLAUDE.md pour la règle de mixité associée.

export async function listGroupsForTrip(tripId) {
  return query(
    `SELECT rg.*, COUNT(r.id) AS member_count
     FROM registration_groups rg
     LEFT JOIN registrations r ON r.group_id = rg.id AND r.status != 'annule'
     WHERE rg.trip_id = ?
     GROUP BY rg.id
     ORDER BY rg.label ASC`,
    [tripId]
  );
}

export async function createGroup(tripId, label, allowMixedGenderRoom) {
  const result = await query(
    `INSERT INTO registration_groups (trip_id, label, allow_mixed_gender_room)
     VALUES (?, ?, ?)`,
    [tripId, label, Boolean(allowMixedGenderRoom)]
  );
  return result.insertId;
}
