import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { emitCrmEvent } from "./events";
import { syncRegistrationPaymentStatus, syncGroupPaymentStatus } from "./paymentStatus";

export async function listPaymentsForRegistration(registrationId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.registration_id = ? AND p.agency_id = ?
     ORDER BY p.payment_date DESC`,
    [registrationId, agencyId]
  );
}

export async function listPaymentsForGroup(groupId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.group_id = ? AND p.agency_id = ?
     ORDER BY p.payment_date DESC`,
    [groupId, agencyId]
  );
}

export async function listPaymentsForVisaService(visaServiceId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.visa_service_id = ? AND p.agency_id = ?
     ORDER BY p.payment_date DESC`,
    [visaServiceId, agencyId]
  );
}

export async function listPaymentsForTicketSale(ticketSaleId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT p.*, su.full_name AS recorded_by_name
     FROM payments p
     LEFT JOIN staff_users su ON su.id = p.recorded_by_staff_id
     WHERE p.ticket_sale_id = ? AND p.agency_id = ?
     ORDER BY p.payment_date DESC`,
    [ticketSaleId, agencyId]
  );
}

// La référence du reçu (receipt_reference) est générée par le système, pas
// saisie par le personnel — garantit un numéro unique et cohérent sur tous
// les reçus imprimés. Format : REC-{année}-{id sur 6 chiffres}.
async function insertPayment(
  { registrationId = null, groupId = null, visaServiceId = null, ticketSaleId = null },
  data,
  recordedByStaffId
) {
  const agencyId = await resolveAgencyId();
  // La cible du paiement (inscription, groupe ou service visa) doit être à
  // NOUS — sinon un identifiant deviné encaisserait chez une autre agence.
  if (registrationId) await assertOwned("registrations", registrationId, agencyId);
  if (groupId) await assertOwned("registration_groups", groupId, agencyId);
  if (visaServiceId) await assertOwned("visa_service_requests", visaServiceId, agencyId);
  if (ticketSaleId) await assertOwned("ticket_sales", ticketSaleId, agencyId);
  const result = await query(
    `INSERT INTO payments (registration_id, group_id, visa_service_id, ticket_sale_id, amount, currency, payment_method, notes, recorded_by_staff_id, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      registrationId,
      groupId,
      visaServiceId,
      ticketSaleId,
      data.amount,
      data.currency || "MAD",
      data.paymentMethod || "especes",
      data.notes || null,
      recordedByStaffId || null,
      agencyId,
    ]
  );
  const paymentId = result.insertId;
  const receiptReference = `REC-${new Date().getFullYear()}-${String(paymentId).padStart(6, "0")}`;
  await query(`UPDATE payments SET receipt_reference = ? WHERE id = ? AND agency_id = ?`, [
    receiptReference,
    paymentId,
    agencyId,
  ]);
  return paymentId;
}

export async function createPayment(registrationId, data, recordedByStaffId) {
  const paymentId = await insertPayment({ registrationId }, data, recordedByStaffId);
  const newStatus = await syncRegistrationPaymentStatus(registrationId, { reactivate: true });
  // Déclencheurs WhatsApp (un remboursement — montant négatif — n'en déclenche pas).
  if (Number(data.amount) > 0) {
    await emitCrmEvent("paiement_recu", { registrationId: Number(registrationId), paymentId, amount: Number(data.amount) });
    if (newStatus === "paye_complet") await emitCrmEvent("statut_paye_complet", { registrationId: Number(registrationId) });
  }
  return paymentId;
}

// Un paiement de groupe (binôme/famille) couvre tous ses membres à la fois
// — voir CLAUDE.md §3quindecies et migration 012.
export async function createGroupPayment(groupId, data, recordedByStaffId) {
  const paymentId = await insertPayment({ groupId }, data, recordedByStaffId);
  await syncGroupPaymentStatus(groupId, { reactivate: true });
  if (Number(data.amount) > 0) await emitCrmEvent("paiement_recu", { groupId: Number(groupId), paymentId, amount: Number(data.amount) });
  return paymentId;
}

// Paiement d'une demande de service visa autonome (hors voyage) — migration 013.
export async function createVisaServicePayment(visaServiceId, data, recordedByStaffId) {
  return insertPayment({ visaServiceId }, data, recordedByStaffId);
}

// Paiement d'une vente de billet d'avion hors programme — migration 036.
export async function createTicketSalePayment(ticketSaleId, data, recordedByStaffId) {
  return insertPayment({ ticketSaleId }, data, recordedByStaffId);
}

export async function deletePayment(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("payments", id, agencyId);
  const rows = await query(`SELECT registration_id, group_id FROM payments WHERE id = ? AND agency_id = ?`, [
    id,
    agencyId,
  ]);
  const registrationId = rows[0]?.registration_id ?? null;
  const groupId = rows[0]?.group_id ?? null;
  await query(`DELETE FROM payments WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  if (registrationId) await syncRegistrationPaymentStatus(registrationId, { reactivate: true });
  if (groupId) await syncGroupPaymentStatus(groupId, { reactivate: true });
}

export async function getPaymentById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT pay.*, su.full_name AS recorded_by_name
     FROM payments pay
     LEFT JOIN staff_users su ON su.id = pay.recorded_by_staff_id
     WHERE pay.id = ? AND pay.agency_id = ?
     LIMIT 1`,
    [id, agencyId]
  );
  const payment = rows[0];
  if (!payment) return null;

  if (payment.registration_id) {
    const [details] = await query(
      `SELECT reg.total_due, reg.base_price, reg.discount_amount, reg.discount_type,
              tr.full_name AS traveler_name, tr.phone_whatsapp,
              t.reference_code, t.departure_date,
              prog.title AS program_title,
              (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
                WHERE p2.registration_id = reg.id) AS total_paid_to_date
       FROM registrations reg
       JOIN travelers tr ON tr.id = reg.traveler_id
       JOIN trips t ON t.id = reg.trip_id
       JOIN programs prog ON prog.id = t.program_id
       WHERE reg.id = ? AND reg.agency_id = ?
       LIMIT 1`,
      [payment.registration_id, agencyId]
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
       WHERE rg.id = ? AND rg.agency_id = ?
       LIMIT 1`,
      [payment.group_id, agencyId]
    );
    const members = await query(
      `SELECT tr.full_name, tr.phone_whatsapp
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id
       WHERE r.group_id = ? AND r.agency_id = ? AND r.status != 'annule'
       ORDER BY tr.full_name ASC`,
      [payment.group_id, agencyId]
    );

    return {
      ...payment,
      ...groupInfo,
      traveler_name: groupInfo.label,
      members,
    };
  }

  // Paiement d'une vente de billet d'avion (hors programme) — migration 036.
  if (payment.ticket_sale_id) {
    const [ticketInfo] = await query(
      `SELECT tr.full_name AS traveler_name, tr.phone_whatsapp,
              ts.origin_iata, ts.destination_iata, ts.departure_date, ts.return_date, ts.pnr,
              a.name AS airline_name, ts.total_due,
              (SELECT COALESCE(SUM(p2.amount), 0) FROM payments p2
                WHERE p2.ticket_sale_id = ts.id) AS total_paid_to_date
       FROM ticket_sales ts
       JOIN travelers tr ON tr.id = ts.traveler_id
       LEFT JOIN airlines a ON a.id = ts.airline_id
       WHERE ts.id = ? AND ts.agency_id = ?
       LIMIT 1`,
      [payment.ticket_sale_id, agencyId]
    );
    return { ...payment, ...ticketInfo, members: null, isTicketSale: true };
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
     WHERE vsr.id = ? AND vsr.agency_id = ?
     LIMIT 1`,
    [payment.visa_service_id, agencyId]
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
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT trip_id, reference_code, departure_date, return_date, trip_status, program_title,
            registrations_count, total_due, total_paid, total_discount, free_count,
            total_due - total_paid AS balance_due
     FROM (
       SELECT t.id AS trip_id, t.reference_code, t.departure_date, t.return_date, t.status AS trip_status,
              p.title AS program_title,
              (SELECT COUNT(*) FROM registrations WHERE trip_id = t.id AND status != 'annule') AS registrations_count,
              -- Réductions accordées et gratuités (migration 042)
              (SELECT COALESCE(SUM(discount_amount), 0) FROM registrations WHERE trip_id = t.id AND status != 'annule') AS total_discount,
              (SELECT COUNT(*) FROM registrations WHERE trip_id = t.id AND status != 'annule' AND discount_type = 'gratuite') AS free_count,
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
       WHERE t.agency_id = ?
     ) x
     ORDER BY departure_date DESC`,
    [agencyId]
  );
}

export async function getPaymentsByPeriod(startDate, endDate) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, tr.full_name, t.reference_code, prog.title AS program_title
     FROM payments pay
     JOIN registrations reg ON reg.id = pay.registration_id
     JOIN travelers tr ON tr.id = reg.traveler_id
     JOIN trips t ON t.id = reg.trip_id
     JOIN programs prog ON prog.id = t.program_id
     WHERE pay.agency_id = ? AND pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     UNION ALL

     SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, CONCAT('Groupe : ', rg.label) AS full_name,
            t.reference_code, prog.title AS program_title
     FROM payments pay
     JOIN registration_groups rg ON rg.id = pay.group_id
     JOIN trips t ON t.id = rg.trip_id
     JOIN programs prog ON prog.id = t.program_id
     WHERE pay.agency_id = ? AND pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     UNION ALL

     SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, tr.full_name,
            vt.name AS reference_code, 'Service visa' AS program_title
     FROM payments pay
     JOIN visa_service_requests vsr ON vsr.id = pay.visa_service_id
     JOIN travelers tr ON tr.id = vsr.traveler_id
     JOIN visa_types vt ON vt.id = vsr.visa_type_id
     WHERE pay.agency_id = ? AND pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     UNION ALL

     SELECT pay.id, pay.amount, pay.currency, pay.payment_method, pay.payment_date,
            pay.receipt_reference, tr.full_name,
            CONCAT(COALESCE(ts.origin_iata, '—'), ' - ', COALESCE(ts.destination_iata, '—')) AS reference_code,
            'Vente de billet' AS program_title
     FROM payments pay
     JOIN ticket_sales ts ON ts.id = pay.ticket_sale_id
     JOIN travelers tr ON tr.id = ts.traveler_id
     WHERE pay.agency_id = ? AND pay.payment_date >= ? AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)

     ORDER BY payment_date DESC`,
    [agencyId, startDate, endDate, agencyId, startDate, endDate, agencyId, startDate, endDate, agencyId, startDate, endDate]
  );
}
