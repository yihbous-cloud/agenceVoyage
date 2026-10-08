import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Service de vente de billets d'avion hors programme (migration 037) — même
// logique que le service visa autonome (lib/visaServices.js) : client
// réutilisé par numéro WhatsApp, vente avec trajet, coût d'achat et prix de
// vente (total_due), versements via payments.ticket_sale_id.

export const TICKET_SALE_STATUSES = ["devis", "reserve", "emis", "annule"];
const TRIP_TYPES = ["aller_simple", "aller_retour"];
const TRAVEL_CLASSES = ["economique", "premium", "affaires", "premiere"];

function invalid(message) {
  const err = new Error(message);
  err.code = "INVALID";
  return err;
}

const iataOrNull = (v) => {
  const s = String(v || "").trim().toUpperCase();
  return s ? s.slice(0, 3) : null;
};
const dateOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null);
const amountOf = (v) => {
  const n = Math.round(Number(v || 0) * 100) / 100;
  return Number.isFinite(n) ? n : NaN;
};

// Champs du trajet/prix communs à la création et à la modification.
function normalizeSaleFields(data) {
  const tripType = TRIP_TYPES.includes(data.tripType) ? data.tripType : "aller_retour";
  const departureDate = dateOrNull(data.departureDate);
  const returnDate = tripType === "aller_retour" ? dateOrNull(data.returnDate) : null;
  if (departureDate && returnDate && returnDate < departureDate) {
    throw invalid("La date de retour doit être postérieure à la date de départ");
  }
  const purchasePrice = amountOf(data.purchasePrice);
  const totalDue = amountOf(data.totalDue);
  if (!(purchasePrice >= 0) || !(totalDue >= 0)) throw invalid("Montant invalide");
  const passengersCount = Math.max(1, parseInt(data.passengersCount, 10) || 1);
  return {
    airlineId: data.airlineId || null,
    tripType,
    originIata: iataOrNull(data.originIata),
    destinationIata: iataOrNull(data.destinationIata),
    departureDate,
    returnDate,
    passengersCount,
    passengerNames: data.passengerNames?.trim() || null,
    travelClass: TRAVEL_CLASSES.includes(data.travelClass) ? data.travelClass : "economique",
    pnr: data.pnr?.trim().toUpperCase() || null,
    ticketNumbers: data.ticketNumbers?.trim() || null,
    purchasePrice,
    totalDue,
    status: TICKET_SALE_STATUSES.includes(data.status) ? data.status : "reserve",
    notes: data.notes?.trim() || null,
  };
}

const SALE_SELECT = `SELECT ts.*, tr.full_name, tr.phone_whatsapp, tr.email AS traveler_email,
            a.name AS airline_name, a.iata_code AS airline_iata,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
              WHERE p.ticket_sale_id = ts.id AND p.agency_id = ts.agency_id) AS total_paid
     FROM ticket_sales ts
     JOIN travelers tr ON tr.id = ts.traveler_id AND tr.agency_id = ts.agency_id
     LEFT JOIN airlines a ON a.id = ts.airline_id AND a.agency_id = ts.agency_id`;

export async function listTicketSales({ status } = {}) {
  const agencyId = await resolveAgencyId();
  const params = [agencyId];
  let extra = "";
  if (status) {
    extra = " AND ts.status = ?";
    params.push(status);
  }
  return query(`${SALE_SELECT} WHERE ts.agency_id = ?${extra} ORDER BY ts.created_at DESC`, params);
}

export async function getTicketSaleStats() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT status, COUNT(*) AS count FROM ticket_sales WHERE agency_id = ? GROUP BY status`,
    [agencyId]
  );
}

export async function getTicketSaleById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`${SALE_SELECT} WHERE ts.id = ? AND ts.agency_id = ? LIMIT 1`, [id, agencyId]);
  return rows[0] || null;
}

export async function createTicketSale(data, registeredByStaffId) {
  const agencyId = await resolveAgencyId();
  if (!data.fullName?.trim()) throw invalid("Le nom du client est requis");
  if (!data.phoneWhatsapp?.trim()) throw invalid("Le numéro WhatsApp est requis");
  const f = normalizeSaleFields(data);
  if (f.airlineId) await assertOwned("airlines", f.airlineId, agencyId);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? AND agency_id = ? LIMIT 1`,
      [data.phoneWhatsapp.trim(), agencyId]
    );
    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
      await connection.execute(
        `UPDATE travelers SET full_name = ?, email = COALESCE(?, email) WHERE id = ? AND agency_id = ?`,
        [data.fullName.trim(), data.email?.trim() || null, travelerId, agencyId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers (full_name, gender, phone_whatsapp, email, agency_id)
         VALUES (?, ?, ?, ?, ?)`,
        [data.fullName.trim(), data.gender || "homme", data.phoneWhatsapp.trim(), data.email?.trim() || null, agencyId]
      );
      travelerId = result.insertId;
    }

    const [result] = await connection.execute(
      `INSERT INTO ticket_sales
         (traveler_id, airline_id, trip_type, origin_iata, destination_iata, departure_date, return_date,
          passengers_count, passenger_names, travel_class, pnr, ticket_numbers, purchase_price, total_due,
          status, notes, registered_by_staff_id, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        travelerId, f.airlineId, f.tripType, f.originIata, f.destinationIata, f.departureDate, f.returnDate,
        f.passengersCount, f.passengerNames, f.travelClass, f.pnr, f.ticketNumbers, f.purchasePrice, f.totalDue,
        f.status, f.notes, registeredByStaffId || null, agencyId,
      ]
    );
    await connection.commit();
    return result.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Remplacement complet des champs de la vente (formulaire unique) ; le
// client (voyageur) n'est pas modifiable ici.
export async function updateTicketSale(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("ticket_sales", id, agencyId);
  const f = normalizeSaleFields(data);
  if (f.airlineId) await assertOwned("airlines", f.airlineId, agencyId);
  await query(
    `UPDATE ticket_sales SET airline_id = ?, trip_type = ?, origin_iata = ?, destination_iata = ?,
            departure_date = ?, return_date = ?, passengers_count = ?, passenger_names = ?, travel_class = ?,
            pnr = ?, ticket_numbers = ?, purchase_price = ?, total_due = ?, status = ?, notes = ?
     WHERE id = ? AND agency_id = ?`,
    [
      f.airlineId, f.tripType, f.originIata, f.destinationIata, f.departureDate, f.returnDate,
      f.passengersCount, f.passengerNames, f.travelClass, f.pnr, f.ticketNumbers, f.purchasePrice,
      f.totalDue, f.status, f.notes, id, agencyId,
    ]
  );
  return getTicketSaleById(id);
}

// Suppression refusée dès qu'un versement existe (passer la vente en
// « annulé » et rembourser plutôt que d'effacer un historique financier).
export async function deleteTicketSale(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("ticket_sales", id, agencyId);
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM payments WHERE ticket_sale_id = ? AND agency_id = ?`,
    [id, agencyId]
  );
  if (Number(row.n) > 0) {
    throw invalid("Impossible de supprimer : des versements sont enregistrés sur cette vente (annulez-la plutôt)");
  }
  await query(`DELETE FROM ticket_sales WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
