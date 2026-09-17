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

export async function getGroupById(id) {
  const rows = await query(
    `SELECT rg.*, t.reference_code, t.departure_date, t.return_date,
            p.id AS program_id, p.title AS program_title
     FROM registration_groups rg
     JOIN trips t ON t.id = rg.trip_id
     JOIN programs p ON p.id = t.program_id
     WHERE rg.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function getGroupMembers(groupId) {
  return query(
    `SELECT r.id AS registration_id, r.status, r.visa_status,
            tr.full_name, tr.gender, tr.phone_whatsapp
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     WHERE r.group_id = ?
     ORDER BY tr.full_name ASC`,
    [groupId]
  );
}

// Le suivi financier (montant dû) d'un groupe est partagé par tous ses
// membres — voir migration 012 et CLAUDE.md.
export async function updateGroupTotalDue(id, totalDue) {
  await query(`UPDATE registration_groups SET total_due = ? WHERE id = ?`, [totalDue, id]);
  return getGroupById(id);
}
