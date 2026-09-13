import { query, getPool } from "./db";
import { getDuffelMode } from "./duffel";

export async function getTripForBooking(tripId) {
  const rows = await query(
    `SELECT t.*, p.title AS program_title
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.id = ?`,
    [tripId]
  );
  return rows[0] || null;
}

// Inscrits confirmés/payés de ce voyage qui n'ont pas encore de billet réservé.
export async function listBookableRegistrations(tripId) {
  return query(
    `SELECT r.id, r.status, tr.full_name, tr.full_name_arabic, tr.gender,
            tr.date_of_birth, tr.passport_number, tr.passport_expiry_date,
            tr.phone_whatsapp, tr.email
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     WHERE r.trip_id = ?
       AND r.status IN ('confirme', 'paye_partiel', 'paye_complet')
       AND r.id NOT IN (
         SELECT registration_id FROM flight_booking_passengers fbp
         JOIN flight_bookings fb ON fb.id = fbp.flight_booking_id
         WHERE fb.status != 'echec'
       )
     ORDER BY tr.full_name ASC`,
    [tripId]
  );
}

export function buildDuffelPassenger(traveler, overrides = {}) {
  const [givenName, ...rest] = traveler.full_name.trim().split(/\s+/);
  return {
    registrationId: traveler.id,
    title: traveler.gender === "femme" ? "mrs" : "mr",
    givenName: overrides.givenName ?? givenName,
    familyName: overrides.familyName ?? (rest.join(" ") || givenName),
    gender: traveler.gender === "femme" ? "f" : "m",
    bornOn: traveler.date_of_birth || "",
    email: overrides.email ?? traveler.email ?? "",
    phoneNumber: overrides.phoneNumber ?? traveler.phone_whatsapp ?? "",
    passportNumber: traveler.passport_number || "",
    passportExpiryDate: traveler.passport_expiry_date || "",
  };
}

function toDuffelPassengerPayload(passenger, duffelPassengerId) {
  const payload = {
    id: duffelPassengerId,
    title: passenger.title,
    given_name: passenger.givenName,
    family_name: passenger.familyName,
    gender: passenger.gender,
    born_on: passenger.bornOn,
    email: passenger.email,
    phone_number: passenger.phoneNumber,
  };

  if (passenger.passportNumber && passenger.passportExpiryDate) {
    payload.identity_documents = [
      {
        type: "passport",
        unique_identifier: passenger.passportNumber,
        expires_on: passenger.passportExpiryDate,
      },
    ];
  }

  return payload;
}

export function buildOrderPassengers(offerPassengers, passengers) {
  return offerPassengers.map((offerPax, index) =>
    toDuffelPassengerPayload(passengers[index], offerPax.id)
  );
}

function extractTicketNumbers(order) {
  const byPassenger = {};
  for (const doc of order.documents || []) {
    for (const uid of doc.unique_identifiers || []) {
      if (uid.passenger_id && uid.unique_identifier) {
        byPassenger[uid.passenger_id] = uid.unique_identifier;
      }
    }
  }
  return byPassenger;
}

export async function recordSuccessfulBooking({
  tripId,
  scope,
  offer,
  order,
  passengers,
  staffId,
}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const ticketNumbers = extractTicketNumbers(order);

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO flight_bookings
         (trip_id, scope, duffel_offer_id, duffel_order_id, booking_reference,
          total_amount, currency, status, duffel_mode, created_by_staff_id, raw_offer, raw_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirme', ?, ?, ?, ?)`,
      [
        tripId,
        scope,
        offer.id,
        order.id,
        order.booking_reference || null,
        offer.total_amount,
        offer.total_currency,
        getDuffelMode(),
        staffId || null,
        JSON.stringify(offer),
        JSON.stringify(order),
      ]
    );

    const bookingId = result.insertId;

    for (const [index, orderPax] of (order.passengers || []).entries()) {
      const registrationId = passengers[index]?.registrationId;
      if (!registrationId) continue;
      await connection.execute(
        `INSERT INTO flight_booking_passengers
           (flight_booking_id, registration_id, duffel_passenger_id, ticket_number)
         VALUES (?, ?, ?, ?)`,
        [bookingId, registrationId, orderPax.id, ticketNumbers[orderPax.id] || null]
      );
    }

    await connection.commit();
    return bookingId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function recordFailedBooking({ tripId, scope, offer, errorMessage, staffId }) {
  const result = await query(
    `INSERT INTO flight_bookings
       (trip_id, scope, duffel_offer_id, total_amount, currency, status, duffel_mode, created_by_staff_id, error_message, raw_offer)
     VALUES (?, ?, ?, ?, ?, 'echec', ?, ?, ?, ?)`,
    [
      tripId,
      scope,
      offer?.id || "",
      offer?.total_amount || 0,
      offer?.total_currency || "EUR",
      getDuffelMode(),
      staffId || null,
      errorMessage,
      offer ? JSON.stringify(offer) : null,
    ]
  );
  return result.insertId;
}

export async function listFlightBookingsForTrip(tripId) {
  return query(
    `SELECT fb.*,
            GROUP_CONCAT(tr.full_name SEPARATOR ', ') AS passenger_names
     FROM flight_bookings fb
     LEFT JOIN flight_booking_passengers fbp ON fbp.flight_booking_id = fb.id
     LEFT JOIN registrations reg ON reg.id = fbp.registration_id
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     WHERE fb.trip_id = ?
     GROUP BY fb.id
     ORDER BY fb.created_at DESC`,
    [tripId]
  );
}

export async function getFlightBookingForRegistration(registrationId) {
  const rows = await query(
    `SELECT fb.*, fbp.ticket_number
     FROM flight_booking_passengers fbp
     JOIN flight_bookings fb ON fb.id = fbp.flight_booking_id
     WHERE fbp.registration_id = ? AND fb.status = 'confirme'
     LIMIT 1`,
    [registrationId]
  );
  return rows[0] || null;
}
