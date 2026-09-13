import { query, getPool } from "./db";

export async function getRoomDetails(roomId) {
  const rows = await query(
    `SELECT rm.id, rm.room_number, rm.room_type, rm.capacity, h.name AS hotel_name
     FROM rooms rm
     JOIN trip_hotels th ON th.id = rm.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     WHERE rm.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
}

export async function getTripSummary(tripId) {
  const rows = await query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date, p.title AS program_title
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.id = ?
     LIMIT 1`,
    [tripId]
  );
  return rows[0] || null;
}

// --- Hôtels associés à un voyage ---

export async function listTripHotels(tripId) {
  return query(
    `SELECT th.*, h.name AS hotel_name, h.city, h.star_rating
     FROM trip_hotels th
     JOIN hotels h ON h.id = th.hotel_id
     WHERE th.trip_id = ?
     ORDER BY th.check_in_date ASC`,
    [tripId]
  );
}

export async function addTripHotel(tripId, hotelId, checkInDate, checkOutDate) {
  const result = await query(
    `INSERT INTO trip_hotels (trip_id, hotel_id, check_in_date, check_out_date)
     VALUES (?, ?, ?, ?)`,
    [tripId, hotelId, checkInDate, checkOutDate]
  );
  return result.insertId;
}

export async function removeTripHotel(id) {
  await query(`DELETE FROM trip_hotels WHERE id = ?`, [id]);
}

// --- Chambres ---

export async function listRoomsForTrip(tripId) {
  return query(
    `SELECT r.*, th.hotel_id, h.name AS hotel_name,
            COUNT(reg.id) AS occupants_count,
            MAX(tr.gender) AS occupants_gender
     FROM rooms r
     JOIN trip_hotels th ON th.id = r.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     LEFT JOIN registrations reg ON reg.room_id = r.id AND reg.status != 'annule'
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     WHERE th.trip_id = ?
     GROUP BY r.id
     ORDER BY h.name ASC, r.room_number ASC`,
    [tripId]
  );
}

export async function createRoom(tripHotelId, data) {
  const result = await query(
    `INSERT INTO rooms (trip_hotel_id, room_number, room_type, capacity)
     VALUES (?, ?, ?, ?)`,
    [tripHotelId, data.roomNumber || null, data.roomType, data.capacity]
  );
  return result.insertId;
}

export async function deleteRoom(id) {
  await query(`DELETE FROM rooms WHERE id = ?`, [id]);
}

// --- Voyageurs non affectés ---

export async function listUnassignedRegistrations(tripId) {
  return query(
    `SELECT r.id, r.room_id, tr.full_name, tr.gender
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     WHERE r.trip_id = ? AND r.status != 'annule' AND r.room_id IS NULL
     ORDER BY tr.full_name ASC`,
    [tripId]
  );
}

// --- Affectation manuelle avec logique anti-conflit ---

export async function assignRegistrationToRoom(registrationId, roomId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[registration]] = await connection.execute(
      `SELECT r.id, r.trip_id, tr.gender
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id
       WHERE r.id = ? FOR UPDATE`,
      [registrationId]
    );

    if (!registration) {
      throw new Error("Inscription introuvable");
    }

    const [[room]] = await connection.execute(
      `SELECT rm.id, rm.capacity, th.trip_id
       FROM rooms rm
       JOIN trip_hotels th ON th.id = rm.trip_hotel_id
       WHERE rm.id = ? FOR UPDATE`,
      [roomId]
    );

    if (!room) {
      throw new Error("Chambre introuvable");
    }

    if (room.trip_id !== registration.trip_id) {
      throw new Error("Cette chambre appartient à un autre voyage");
    }

    const [occupants] = await connection.execute(
      `SELECT tr.gender
       FROM registrations reg
       JOIN travelers tr ON tr.id = reg.traveler_id
       WHERE reg.room_id = ? AND reg.status != 'annule' AND reg.id != ?`,
      [roomId, registrationId]
    );

    if (occupants.length >= room.capacity) {
      throw new Error("Chambre complète");
    }

    if (occupants.length > 0 && occupants[0].gender !== registration.gender) {
      throw new Error("Chambre déjà occupée par l'autre genre");
    }

    await connection.execute(`UPDATE registrations SET room_id = ? WHERE id = ?`, [
      roomId,
      registrationId,
    ]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function unassignRegistration(registrationId) {
  await query(`UPDATE registrations SET room_id = NULL WHERE id = ?`, [registrationId]);
}

// --- Répartition automatique ---
// Regroupe par genre, remplit les chambres compatibles par ordre de place
// disponible croissante (comble les chambres partiellement occupées en premier).
export async function autoAssignTrip(tripId) {
  const rooms = await listRoomsForTrip(tripId);
  const unassigned = await listUnassignedRegistrations(tripId);

  const roomState = rooms.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    occupants: Number(r.occupants_count),
    gender: r.occupants_gender || null,
  }));

  let assignedCount = 0;
  const skipped = [];

  const byGender = { homme: [], femme: [] };
  for (const reg of unassigned) {
    byGender[reg.gender].push(reg);
  }

  // Traite d'abord le groupe le plus nombreux : évite qu'un petit groupe
  // n'occupe une chambre mixte-libre et ne prive le groupe plus nombreux
  // d'une place dont il a davantage besoin.
  const genderOrder =
    byGender.femme.length > byGender.homme.length
      ? ["femme", "homme"]
      : ["homme", "femme"];

  for (const gender of genderOrder) {
    for (const reg of byGender[gender]) {
      const candidate = roomState
        .filter(
          (r) =>
            r.occupants < r.capacity && (r.gender === null || r.gender === gender)
        )
        .sort((a, b) => a.capacity - a.occupants - (b.capacity - b.occupants))[0];

      if (!candidate) {
        skipped.push(reg);
        continue;
      }

      await query(`UPDATE registrations SET room_id = ? WHERE id = ?`, [
        candidate.id,
        reg.id,
      ]);
      candidate.occupants += 1;
      candidate.gender = gender;
      assignedCount += 1;
    }
  }

  return { assignedCount, skippedCount: skipped.length };
}
