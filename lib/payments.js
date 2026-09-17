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

export async function listPaymentsForGroup(groupId) {
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.group_id = ?
     ORDER BY p.payment_date DESC`,
    [groupId]
  );
}

export async function listPaymentsForVisaService(visaServiceId) {
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.visa_service_id = ?
     ORDER BY p.payment_date DESC`,
    [visaServiceId]
  );
}

// La référence du reçu (receipt_reference) est générée par le système, pas
// saisie par le personnel — garantit un numéro unique et cohérent sur tous
// les reçus imprimés. Format : REC-{année}-{id sur 6 chiffres}.
async function insertPayment({ registrationId = null, groupId = null, visaServiceId = null }, data, recordedByStaffId) {
  const result = await query(
    `INSERT INTO payments (registration_id, group_id, visa_service_id, amount, currency, payment_method, notes, recorded_by_staff_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      registrationId,
      groupId,
      visaServiceId,
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

export async function createPayment(registrationId, data, recordedByStaffId) {
  return insertPayment({ registrationId }, data, recordedByStaffId);
}

// Un paiement de groupe (binôme/famille) couvre tous ses membres à la fois
// — voir CLAUDE.md §3quindecies et migration 012.
export async function createGroupPayment(groupId, data, recordedByStaffId) {
  return insertPayment({ groupId }, data, recordedByStaffId);
}

// Paiement d'une demande de service visa autonome (hors voyage) — migration 013.
export async function createVisaServicePayment(visaServiceId, data, recordedByStaffId) {
  return insertPayment({ visaServiceId }, data, recordedByStaffId);
}

export async function deletePayment(id) {
  await query(`DELETE FROM payments WHERE id = ?`, [id]);
}

export async function getPaymentById(id) {
  const rows = await query(
    `SELECT pay.*, su.full_name AS recorded_by_name
     FROM payments pay
     LEFT JOIN staff_users su ON su.id = pay.recorded_by_staff_id
     WHERE pay.id = ?
     LIMIT 1`,
    [id]
  );
  const payment = rows[0];
  if (!payment) return null;

  if (payment.registration_id) {
    const [details] = await query(
      `SELECT reg.total_due,
              tr.full_name AS traveler_name, tr.phone_whatsapp,
              t.reference_code, t.departure_date,
              prog.title AS program_title,
              (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
                WHERE p2.registration_id = reg.id) AS total_paid_to_date
       FROM registrations reg
       JOIN travelers tr ON tr.id = reg.traveler_id
       JOIN trips t ON t.id = reg.trip_id
       JOIN programs prog ON prog.id = t.program_id
       WHERE reg.id = ?
       LIMIT 1`,
      [payment.registration_id]
    );
    return { ...payment, ...details, members: null };
  }

  if (payment.group_id) {
    // Paiement de groupe : le reçu liste chaque membre, le solde est celui
    // du groupe entier (pas d'un membre en particulier).
    const [groupInfo] = await query(
      `SELECT rg.label, rg.total_due,
              t.reference_code, t.departure_date,
              prog.title AS program_title,
              (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
                WHERE p2.group_id = rg.id) AS total_paid_to_date
       FROM registration_groups rg
       JOIN trips t ON t.id = rg.trip_id
       JOIN programs prog ON prog.id = t.program_id
       WHERE rg.id = ?
       LIMIT 1`,
      [payment.group_id]
    );
    const members = await query(
      `SELECT tr.full_name, tr.phone_whatsapp
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id
       WHERE r.group_id = ? AND r.status != 'annule'
       ORDER BY tr.full_name ASC`,
      [payment.group_id]
    );

    return {
      ...payment,
      ...groupInfo,
      traveler_name: groupInfo.label,
      members,
    };
  }

  // Paiement de service visa autonome (hors voyage) — pas de programme/voyage.
  const [visaServiceInfo] = await query(
    `SELECT tr.full_name AS traveler_name, tr.phone_whatsapp,
            vt.name AS visa_type_name, vt.country,
            vsr.total_due,
            (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
              WHERE p2.visa_service_id = vsr.id) AS total_paid_to_date
     FROM visa_service_requests vsr
     JOIN travelers tr ON tr.id = vsr.traveler_id
     JOIN visa_types vt ON vt.id = vsr.visa_type_id
     WHERE vsr.id = ?
     LIMIT 1`,
    [payment.visa_service_id]
  );

  return { ...payment, ...visaServiceInfo, members: null, isVisaService: true };
}

// --- Rapports financiers ---

// Calculées via des sous-requêtes corrélées plutôt que des LEFT JOIN
// agrégés : un registration ayant plusieurs paiements (ou un trip ayant
// plusieurs registrations) provoquerait un fan-out des lignes jointes et
// fausserait SUM(total_due) par double-comptage. Additionne aussi le volet
// financier des groupes (registration_groups.total_due / payments.group_id,
// voir migration 012) en plus des inscriptions individuelles (group_id
// NULL) pour ne pas les compter deux fois ni les oublier.
export async function getFinancialSummaryByTrip() {
  return query(
    `SELECT trip_id, reference_code, departure_date, program_title,
            registrations_count, total_due, total_paid,
            total_due - total_paid AS balance_due
     FROM (
       SELECT t.id AS trip_id, t.reference_code, t.departure_date, p.title AS program_title,
              (SELECT COUNT(*) FROM registrations WHERE trip_id = t.id AND status != 'annule') AS registrations_count,
              (
                COALESCE((SELECT SUM(total_due) FROM registrations WHERE trip_id = t.id AND status != 'annule' AND group_id IS NULL), 0)
                + COALESCE((SELECT SUM(total_due) FROM registration_groups WHERE trip_id = t.id), 0)
              ) AS total_due,
              (
                COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN registrations r ON r.id = pay.registration_id WHERE r.trip_id = t.id AND r.status != 'annule' AND r.group_id IS NULL), 0)
                + COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN registration_groups rg ON rg.id = pay.group_id WHERE rg.trip_id = t.id), 0)
              ) AS total_paid
       FROM trips t
       JOIN programs p ON p.id = t.program_id
     ) x
     ORDER BY departure_date DESC`
  );
}

export async function getFinancialSummaryByProgram() {
  return query(
    `SELECT program_id, program_title, registrations_count, total_due, total_paid,
            total_due - total_paid AS balance_due
     FROM (
       SELECT p.id AS program_id, p.title AS program_title,
              (SELECT COUNT(*) FROM registrations r JOIN trips t ON t.id = r.trip_id WHERE t.program_id = p.id AND r.status != 'annule') AS registrations_count,
              (
                COALESCE((SELECT SUM(r.total_due) FROM registrations r JOIN trips t ON t.id = r.trip_id WHERE t.program_id = p.id AND r.status != 'annule' AND r.group_id IS NULL), 0)
                + COALESCE((SELECT SUM(rg.total_due) FROM registration_groups rg JOIN trips t ON t.id = rg.trip_id WHERE t.program_id = p.id), 0)
              ) AS total_due,
              (
                COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN registrations r ON r.id = pay.registration_id JOIN trips t ON t.id = r.trip_id WHERE t.program_id = p.id AND r.status != 'annule' AND r.group_id IS NULL), 0)
                + COALESCE((SELECT SUM(pay.amount) FROM payments pay JOIN registration_groups rg ON rg.id = pay.group_id JOIN trips t ON t.id = rg.trip_id WHERE t.program_id = p.id), 0)
              ) AS total_paid
       FROM programs p
     ) x
     ORDER BY program_title ASC`
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

     UNION ALL

     SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, CONCAT('Groupe : ', rg.label) AS full_name,
            t.reference_code, prog.title AS program_title
     FROM payments pay
     JOIN registration_groups rg ON rg.id = pay.group_id
     JOIN trips t ON t.id = rg.trip_id
     JOIN programs prog ON prog.id = t.program_id
     WHERE pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     UNION ALL

     SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, tr.full_name,
            vt.name AS reference_code, 'Service visa' AS program_title
     FROM payments pay
     JOIN visa_service_requests vsr ON vsr.id = pay.visa_service_id
     JOIN travelers tr ON tr.id = vsr.traveler_id
     JOIN visa_types vt ON vt.id = vsr.visa_type_id
     WHERE pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     ORDER BY payment_date DESC`,
    [startDate, endDate, startDate, endDate, startDate, endDate]
  );
}
