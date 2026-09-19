import { query, getPool } from "./db";
import { setHotelPreferencesForRegistration } from "./registrationHotelPreferences";

export async function getDashboardStats() {
  const [statusCounts] = await Promise.all([
    query(
      `SELECT status, COUNT(*) AS count FROM registrations GROUP BY status`
    ),
  ]);

  const upcomingTrips = await query(
    `SELECT t.id, t.reference_code, t.departure_date, p.title,
            COUNT(r.id) AS registered_count, t.total_seats
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registrations r ON r.trip_id = t.id AND r.status != 'annule'
     WHERE t.departure_date >= CURDATE()
     GROUP BY t.id
     ORDER BY t.departure_date ASC
     LIMIT 5`
  );

  return { statusCounts, upcomingTrips };
}

export async function listRegistrations({ tripId, status, q } = {}) {
  const conditions = [];
  const params = [];

  if (tripId) {
    conditions.push("r.trip_id = ?");
    params.push(tripId);
  }
  if (status) {
    conditions.push("r.status = ?");
    params.push(status);
  }
  if (q) {
    // Recherche par nom du voyageur OU par nom du groupe/binôme auquel il
    // appartient (registration_groups.label) — un même champ de recherche
    // couvre les deux cas, voir CLAUDE.md.
    conditions.push("(tr.full_name LIKE ? OR rg.label LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query(
    `SELECT r.id, r.status, r.visa_status, r.total_due, r.registration_date,
            tr.id AS traveler_id, tr.full_name, tr.phone_whatsapp, tr.passport_number,
            t.id AS trip_id, t.reference_code, t.departure_date,
            p.title AS program_title,
            r.group_id, rg.label AS group_label
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN trips t ON t.id = r.trip_id
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     ${where}
     ORDER BY r.registration_date DESC`,
    params
  );
}

export async function getRegistrationById(id) {
  const rows = await query(
    `SELECT r.*, tr.full_name, tr.full_name_arabic, tr.gender, tr.date_of_birth,
            tr.national_id, tr.passport_number, tr.passport_expiry_date, tr.info_confirmed,
            tr.phone_whatsapp, tr.email AS traveler_email, tr.address,
            t.reference_code, t.departure_date, t.return_date, t.flight_ticket_price,
            p.id AS program_id, p.title AS program_title,
            rg.label AS group_label, rg.allow_mixed_gender_room
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN trips t ON t.id = r.trip_id
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     WHERE r.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createRegistration(data) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Montant dû par défaut = prix du voyage, pour ne pas partir de 0 et
    // obliger le personnel à le ressaisir — reste modifiable ensuite
    // (EditRegistrationForm.jsx). Un appelant peut toujours forcer un autre
    // montant via data.totalDue (ex. tarif négocié).
    let totalDue = data.totalDue;
    if (totalDue === undefined || totalDue === null || totalDue === "") {
      const [[trip]] = await connection.execute(
        `SELECT price_per_person FROM trips WHERE id = ?`,
        [data.tripId]
      );
      totalDue = trip ? trip.price_per_person : 0;
    }

    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? LIMIT 1`,
      [data.phoneWhatsapp]
    );

    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
      await connection.execute(
        `UPDATE travelers SET full_name = ?, full_name_arabic = ?, gender = ?,
           date_of_birth = ?, national_id = ?, passport_number = ?,
           passport_expiry_date = ?, email = ?, address = ?
         WHERE id = ?`,
        [
          data.fullName,
          data.fullNameArabic || null,
          data.gender,
          data.dateOfBirth || null,
          data.nationalId || null,
          data.passportNumber || null,
          data.passportExpiryDate || null,
          data.email || null,
          data.address || null,
          travelerId,
        ]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers
           (full_name, full_name_arabic, gender, date_of_birth, national_id,
            passport_number, passport_expiry_date, phone_whatsapp, email, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.fullName,
          data.fullNameArabic || null,
          data.gender,
          data.dateOfBirth || null,
          data.nationalId || null,
          data.passportNumber || null,
          data.passportExpiryDate || null,
          data.phoneWhatsapp,
          data.email || null,
          data.address || null,
        ]
      );
      travelerId = result.insertId;
    }

    const [registrationResult] = await connection.execute(
      `INSERT INTO registrations
         (trip_id, traveler_id, registered_by_staff_id, status, total_due, notes,
          preferred_room_type, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tripId,
        travelerId,
        data.registeredByStaffId || null,
        data.status || "inscrit",
        totalDue,
        data.notes || null,
        data.preferredRoomType || null,
        data.groupId || null,
      ]
    );
    const registrationId = registrationResult.insertId;

    // Une préférence d'hôtel par ville (§3quaterdecies/§3quattuorvicies) —
    // hotelPreferences : [{ city, hotelId }].
    if (Array.isArray(data.hotelPreferences)) {
      for (const pref of data.hotelPreferences) {
        if (!pref.hotelId) continue;
        await connection.execute(
          `INSERT INTO registration_hotel_preferences (registration_id, city, hotel_id)
           VALUES (?, ?, ?)`,
          [registrationId, pref.city, pref.hotelId]
        );
      }
    }

    await connection.commit();
    return { id: registrationId, travelerId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateRegistration(id, data) {
  const fields = [];
  const params = [];

  const map = {
    status: "status",
    visaStatus: "visa_status",
    totalDue: "total_due",
    roomId: "room_id",
    notes: "notes",
    preferredRoomType: "preferred_room_type",
    groupId: "group_id",
  };

  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE registrations SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  // Une préférence d'hôtel par ville — hotelPreferences : [{ city, hotelId }].
  if (Array.isArray(data.hotelPreferences)) {
    await setHotelPreferencesForRegistration(id, data.hotelPreferences);
  }

  return getRegistrationById(id);
}

export async function updateTraveler(travelerId, data) {
  await query(
    `UPDATE travelers SET full_name = ?, phone_whatsapp = ?, gender = ?, passport_number = ?, passport_expiry_date = ?, email = ?, info_confirmed = TRUE
     WHERE id = ?`,
    [
      data.fullName,
      data.phoneWhatsapp,
      data.gender,
      data.passportNumber || null,
      data.passportExpiryDate || null,
      data.email || null,
      travelerId,
    ]
  );
}

export async function deleteRegistration(id) {
  await query(`DELETE FROM registrations WHERE id = ?`, [id]);
}

export async function listOpenTripsForSelect() {
  return query(
    `SELECT t.id, t.reference_code, t.departure_date, t.price_per_person, t.currency, p.title
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.status IN ('ouvert', 'planifie')
     ORDER BY t.departure_date ASC`
  );
}
