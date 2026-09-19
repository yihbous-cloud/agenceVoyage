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
     ORDER BY h.city ASC, th.check_in_date ASC`,
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
    `SELECT r.*, th.hotel_id, h.name AS hotel_name, h.city AS hotel_city,
            COUNT(reg.id) AS occupants_count,
            GROUP_CONCAT(DISTINCT tr.gender ORDER BY tr.gender SEPARATOR ' + ') AS occupants_gender
     FROM rooms r
     JOIN trip_hotels th ON th.id = r.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     LEFT JOIN registrations reg ON reg.room_id = r.id AND reg.status != 'annule'
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     WHERE th.trip_id = ?
     GROUP BY r.id
     ORDER BY h.city ASC, h.name ASC, r.room_number ASC`,
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

// N'affiche (et ne propose à l'affectation/répartition auto) que les
// voyageurs ayant au moins un versement enregistré ET une démarche visa au
// moins lancée — inutile de réserver une chambre à quelqu'un qui n'a encore
// ni payé ni entamé son visa, ça peut encore changer. Un acompte partiel et
// un visa "en cours" suffisent (pas besoin d'attendre le paiement complet ni
// l'accord définitif du visa, qui peut prendre du temps) — voir CLAUDE.md.
export async function listUnassignedRegistrations(tripId) {
  return query(
    `SELECT r.id, r.room_id, r.preferred_hotel_id, r.preferred_room_type,
            r.group_id, rg.label AS group_label, rg.allow_mixed_gender_room,
            tr.full_name, tr.gender, h.name AS preferred_hotel_name
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     LEFT JOIN hotels h ON h.id = r.preferred_hotel_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     WHERE r.trip_id = ? AND r.room_id IS NULL
       AND r.status IN ('paye_partiel', 'paye_complet')
       AND r.visa_status IN ('en_cours', 'accorde')
     ORDER BY tr.full_name ASC`,
    [tripId]
  );
}

// --- Voyageurs déjà affectés ---
// Pour vérifier, une fois la chambre attribuée, qu'elle correspond bien à la
// préférence exprimée à l'inscription (§3quaterdecies) — sans ça, un
// changement de chambre manuel (ou une répartition automatique qui ne
// trouvait plus de chambre compatible) peut placer un voyageur dans une
// chambre différente de ce qu'il avait demandé, sans que personne ne le
// remarque une fois la chambre affichée comme "occupée".
export async function listAssignedRegistrationsForTrip(tripId) {
  return query(
    `SELECT r.id, r.room_id, r.preferred_hotel_id, r.preferred_room_type,
            tr.full_name, tr.gender, h.name AS preferred_hotel_name
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     LEFT JOIN hotels h ON h.id = r.preferred_hotel_id
     WHERE r.trip_id = ? AND r.status != 'annule' AND r.room_id IS NOT NULL
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
      `SELECT r.id, r.trip_id, r.group_id, tr.gender, rg.allow_mixed_gender_room
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id
       LEFT JOIN registration_groups rg ON rg.id = r.group_id
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
      `SELECT tr.gender, reg.group_id
       FROM registrations reg
       JOIN travelers tr ON tr.id = reg.traveler_id
       WHERE reg.room_id = ? AND reg.status != 'annule' AND reg.id != ?`,
      [roomId, registrationId]
    );

    if (occupants.length >= room.capacity) {
      throw new Error("Chambre complète");
    }

    // Non-mixité : seule exception, un couple/famille du même groupe
    // (registration_groups.allow_mixed_gender_room) peut partager une
    // chambre entre genres différents — jamais une mixité générale de la
    // chambre avec des occupants extérieurs au groupe.
    const otherGenderOccupants = occupants.filter((o) => o.gender !== registration.gender);
    if (otherGenderOccupants.length > 0) {
      const exceptionApplies =
        registration.group_id &&
        registration.allow_mixed_gender_room &&
        otherGenderOccupants.every((o) => o.group_id === registration.group_id);
      if (!exceptionApplies) {
        throw new Error("Chambre déjà occupée par l'autre genre");
      }
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
    hotelId: r.hotel_id,
    roomType: r.room_type,
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

  // Traite d'abord les voyageurs ayant exprimé une préférence (hôtel et/ou
  // type de chambre) : sans ça, un voyageur sans préférence traité plus tôt
  // (ordre alphabétique) peut occuper la chambre qu'un voyageur avec
  // préférence, traité plus tard, avait explicitement demandée — le score
  // de préférence ne joue qu'au moment de CE choix précis, il ne réserve
  // rien pour plus tard. Prioriser l'ordre de traitement garantit que la
  // préférence est respectée dès le départ, pas seulement en tie-break.
  const hasPreference = (reg) => Boolean(reg.preferred_hotel_id || reg.preferred_room_type);
  for (const gender of ["homme", "femme"]) {
    byGender[gender].sort((a, b) => Number(hasPreference(b)) - Number(hasPreference(a)));
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
      // Priorise une chambre correspondant à la préférence exprimée à
      // l'inscription : un score (hôtel + type = 3, un seul des deux = 1 ou
      // 2, aucun = 0) évite qu'une chambre ne matchant que l'hôtel ne batte
      // une chambre matchant hôtel ET type via le seul tie-break de
      // remplissage. À score égal, retombe sur l'heuristique de remplissage
      // (comble les chambres partielles d'abord).
      const preferenceScore = (r) =>
        (reg.preferred_hotel_id && r.hotelId === reg.preferred_hotel_id ? 2 : 0) +
        (reg.preferred_room_type && r.roomType === reg.preferred_room_type ? 1 : 0);

      const candidate = roomState
        .filter(
          (r) =>
            r.occupants < r.capacity && (r.gender === null || r.gender === gender)
        )
        .sort((a, b) => {
          const scoreDiff = preferenceScore(b) - preferenceScore(a);
          if (scoreDiff !== 0) return scoreDiff;
          return a.capacity - a.occupants - (b.capacity - b.occupants);
        })[0];

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
