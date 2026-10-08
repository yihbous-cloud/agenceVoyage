import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { tripArchivedSql } from "./tripArchive";

// Crédits en cours = montants encore dus par les clients (dû − payé > 0).
// Une inscription individuelle et un groupe sont deux "débiteurs" distincts
// (le suivi financier d'un groupe est partagé, CLAUDE.md §3quindecies) ;
// les inscriptions annulées sont exclues. `archived` : true = voyages
// clôturés, false = voyages en cours, undefined = tous (lib/tripArchive.js).
export async function listOutstandingCredits({ archived } = {}) {
  const agencyId = await resolveAgencyId();
  const tripFilter =
    archived === true ? `AND ${tripArchivedSql("t")}` : archived === false ? `AND NOT ${tripArchivedSql("t")}` : "";

  const rows = await query(
    `SELECT * FROM (
       SELECT 'individuel' AS kind, r.id AS id, tr.full_name AS name, tr.full_name_arabic AS name_arabic,
              tr.phone_whatsapp, r.status,
              t.id AS trip_id, t.departure_date, t.return_date, p.id AS program_id, p.title AS program_title,
              r.total_due,
              (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay
                WHERE pay.registration_id = r.id AND pay.agency_id = r.agency_id) AS total_paid,
              (SELECT MAX(pay.payment_date) FROM payments pay
                WHERE pay.registration_id = r.id AND pay.agency_id = r.agency_id) AS last_payment_date
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
       WHERE r.agency_id = ? AND r.group_id IS NULL AND r.status != 'annule' ${tripFilter}

       UNION ALL

       SELECT 'groupe' AS kind, rg.id AS id, rg.label AS name, NULL AS name_arabic,
              (SELECT tr2.phone_whatsapp FROM registrations r2
                 JOIN travelers tr2 ON tr2.id = r2.traveler_id
                WHERE r2.id = rg.responsible_registration_id) AS phone_whatsapp,
              NULL AS status,
              t.id AS trip_id, t.departure_date, t.return_date, p.id AS program_id, p.title AS program_title,
              rg.total_due,
              (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay
                WHERE pay.group_id = rg.id AND pay.agency_id = rg.agency_id) AS total_paid,
              (SELECT MAX(pay.payment_date) FROM payments pay
                WHERE pay.group_id = rg.id AND pay.agency_id = rg.agency_id) AS last_payment_date
       FROM registration_groups rg
       JOIN trips t ON t.id = rg.trip_id AND t.agency_id = rg.agency_id
       JOIN programs p ON p.id = t.program_id AND p.agency_id = rg.agency_id
       WHERE rg.agency_id = ? ${tripFilter}
         AND EXISTS (SELECT 1 FROM registrations r3
                      WHERE r3.group_id = rg.id AND r3.agency_id = rg.agency_id AND r3.status != 'annule')
     ) c
     WHERE c.total_due - c.total_paid > 0.005
     ORDER BY c.departure_date DESC, c.name ASC`,
    [agencyId, agencyId]
  );

  return rows.map((row) => ({
    ...row,
    balance: Number(row.total_due) - Number(row.total_paid),
  }));
}
