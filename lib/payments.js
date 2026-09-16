import { query } from "./db";

export async function listPaymentsForRegistration(registrationId) {
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.registration_id = ?
     ORDER BY p.payment_date DESC`,
    [registrationId]
  );
}

// La référence du reçu (receipt_reference) est générée par le système, pas
// saisie par le personnel — garantit un numéro unique et cohérent sur tous
// les reçus imprimés. Format : REC-{année}-{id sur 6 chiffres}.
export async function createPayment(registrationId, data, recordedByStaffId) {
  const result = await query(
    `INSERT INTO payments (registration_id, amount, currency, payment_method, notes, recorded_by_staff_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      registrationId,
      data.amount,
      data.currency || "MAD",
      data.paymentMethod || "especes",
      data.notes || null,
      recordedByStaffId || null,
    ]
  );
  const paymentId = result.insertId;
  const receiptReference = `REC-${new Date().getFullYear()}-${String(paymentId).padStart(6, "0")}`;
  await query(`UPDATE payments SET receipt_reference = ? WHERE id = ?`, [receiptReference, paymentId]);
  return paymentId;
}

export async function deletePayment(id) {
  await query(`DELETE FROM payments WHERE id = ?`, [id]);
}

export async function getPaymentById(id) {
  const rows = await query(
    `SELECT pay.*, su.full_name AS recorded_by_name,
            reg.id AS registration_id, reg.total_due,
            tr.full_name AS traveler_name, tr.phone_whatsapp,
            t.reference_code, t.departure_date,
            prog.title AS program_title,
            (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
              WHERE p2.registration_id = pay.registration_id) AS total_paid_to_date
     FROM payments pay
     JOIN registrations reg ON reg.id = pay.registration_id
     JOIN travelers tr ON tr.id = reg.traveler_id
     JOIN trips t ON t.id = reg.trip_id
     JOIN programs prog ON prog.id = t.program_id
     LEFT JOIN staff_users su ON su.id = pay.recorded_by_staff_id
     WHERE pay.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// --- Rapports financiers ---

export async function getFinancialSummaryByTrip() {
  return query(
    `SELECT t.id AS trip_id, t.reference_code, t.departure_date, p.title AS program_title,
            COUNT(reg.id) AS registrations_count,
            COALESCE(SUM(reg.total_due), 0) AS total_due,
            COALESCE(SUM(pay.amount), 0) AS total_paid,
            COALESCE(SUM(reg.total_due), 0) - COALESCE(SUM(pay.amount), 0) AS balance_due
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registrations reg ON reg.trip_id = t.id AND reg.status != 'annule'
     LEFT JOIN payments pay ON pay.registration_id = reg.id
     GROUP BY t.id
     ORDER BY t.departure_date DESC`
  );
}

export async function getFinancialSummaryByProgram() {
  return query(
    `SELECT p.id AS program_id, p.title AS program_title,
            COUNT(reg.id) AS registrations_count,
            COALESCE(SUM(reg.total_due), 0) AS total_due,
            COALESCE(SUM(pay.amount), 0) AS total_paid,
            COALESCE(SUM(reg.total_due), 0) - COALESCE(SUM(pay.amount), 0) AS balance_due
     FROM programs p
     LEFT JOIN trips t ON t.program_id = p.id
     LEFT JOIN registrations reg ON reg.trip_id = t.id AND reg.status != 'annule'
     LEFT JOIN payments pay ON pay.registration_id = reg.id
     GROUP BY p.id
     ORDER BY p.title ASC`
  );
}

export async function getPaymentsByPeriod(startDate, endDate) {
  return query(
    `SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, tr.full_name, t.reference_code, prog.title AS program_title
     FROM payments pay
     JOIN registrations reg ON reg.id = pay.registration_id
     JOIN travelers tr ON tr.id = reg.traveler_id
     JOIN trips t ON t.id = reg.trip_id
     JOIN programs prog ON prog.id = t.program_id
     WHERE pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
     ORDER BY pay.payment_date DESC`,
    [startDate, endDate]
  );
}
