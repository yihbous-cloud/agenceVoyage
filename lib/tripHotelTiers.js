import { query, getPool } from "./db";
import { ROOM_TYPES } from "./roomTypes";

export async function listTiersForTrip(tripId) {
  const tiers = await query(
    `SELECT tht.*,
            mh.name AS makkah_hotel_name, mh.city AS makkah_hotel_city,
            dh.name AS madinah_hotel_name, dh.city AS madinah_hotel_city
     FROM trip_hotel_tiers tht
     JOIN hotels mh ON mh.id = tht.makkah_hotel_id
     JOIN hotels dh ON dh.id = tht.madinah_hotel_id
     WHERE tht.trip_id = ?
     ORDER BY tht.sort_order ASC, tht.id ASC`,
    [tripId]
  );
  if (tiers.length === 0) return tiers;

  const placeholders = tiers.map(() => "?").join(", ");
  const prices = await query(
    `SELECT * FROM trip_hotel_tier_prices WHERE tier_id IN (${placeholders}) ORDER BY room_type ASC`,
    tiers.map((t) => t.id)
  );
  return tiers.map((t) => ({ ...t, prices: prices.filter((p) => p.tier_id === t.id) }));
}

async function insertTierPrices(connection, tierId, prices) {
  for (const p of prices || []) {
    if (!ROOM_TYPES.includes(p.roomType)) continue;
    if (p.pricePerPerson === undefined || p.pricePerPerson === null || p.pricePerPerson === "") continue;
    await connection.execute(
      `INSERT INTO trip_hotel_tier_prices (tier_id, room_type, price_per_person, seats_limit)
       VALUES (?, ?, ?, ?)`,
      [tierId, p.roomType, p.pricePerPerson, p.seatsLimit ?? null]
    );
  }
}

export async function createTier(tripId, data) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trip_hotel_tiers
         (trip_id, label, makkah_hotel_id, makkah_board_basis, madinah_hotel_id, madinah_board_basis, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        data.label,
        data.makkahHotelId,
        data.makkahBoardBasis,
        data.madinahHotelId,
        data.madinahBoardBasis,
        data.sortOrder || 0,
      ]
    );
    await insertTierPrices(connection, result.insertId, data.prices);
    await connection.commit();
    return result.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateTier(tierId, data) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE trip_hotel_tiers SET label=?, makkah_hotel_id=?, makkah_board_basis=?,
         madinah_hotel_id=?, madinah_board_basis=?, sort_order=? WHERE id=?`,
      [
        data.label,
        data.makkahHotelId,
        data.makkahBoardBasis,
        data.madinahHotelId,
        data.madinahBoardBasis,
        data.sortOrder || 0,
        tierId,
      ]
    );
    await connection.execute(`DELETE FROM trip_hotel_tier_prices WHERE tier_id = ?`, [tierId]);
    await insertTierPrices(connection, tierId, data.prices);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Bloquée par la contrainte FK fk_registrations_selected_tier si au moins une
// inscription référence encore ce tier — l'appelant (route API) traduit
// err.code === "ER_ROW_IS_REFERENCED_2" en message convivial.
export async function deleteTier(tierId) {
  await query(`DELETE FROM trip_hotel_tiers WHERE id = ?`, [tierId]);
}

// Appelée DEPUIS la transaction déjà ouverte par createRegistration
// (lib/registrations.js) — verrouille la ligne de prix (tier_id + room_type)
// avec FOR UPDATE avant de compter les inscriptions existantes, exactement
// comme assignRegistrationToRoom verrouille la chambre avant de compter ses
// occupants (lib/roomAssignment.js). Renvoie le prix par personne à utiliser
// comme total_due par défaut.
export async function reserveTierRoomTypeCapacity(connection, tierId, roomType) {
  if (!roomType) {
    throw new Error("Le type de chambre est requis pour choisir un tarif d'hébergement");
  }

  const [[priceRow]] = await connection.execute(
    `SELECT id, price_per_person, seats_limit
     FROM trip_hotel_tier_prices
     WHERE tier_id = ? AND room_type = ?
     FOR UPDATE`,
    [tierId, roomType]
  );
  if (!priceRow) {
    throw new Error("Ce tarif n'a pas de prix défini pour ce type de chambre");
  }

  if (priceRow.seats_limit !== null) {
    const [[{ count }]] = await connection.execute(
      `SELECT COUNT(*) AS count FROM registrations
       WHERE selected_tier_id = ? AND preferred_room_type = ? AND status != 'annule'`,
      [tierId, roomType]
    );
    if (count >= priceRow.seats_limit) {
      throw new Error("Places épuisées pour ce tarif et ce type de chambre");
    }
  }

  return Number(priceRow.price_per_person);
}
