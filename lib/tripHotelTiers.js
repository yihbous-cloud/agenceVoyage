import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";
import { ROOM_TYPES } from "./roomTypes";

export async function listTiersForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  const tiers = await query(
    `SELECT tht.*,
            ${hotelNameSql("mh", locale)} AS makkah_hotel_name, mh.city AS makkah_hotel_city,
            ${hotelNameSql("dh", locale)} AS madinah_hotel_name, dh.city AS madinah_hotel_city
     FROM trip_hotel_tiers tht
     JOIN hotels mh ON mh.id = tht.makkah_hotel_id
     JOIN hotels dh ON dh.id = tht.madinah_hotel_id
     WHERE tht.trip_id = ? AND tht.agency_id = ?
     ORDER BY tht.sort_order ASC, tht.id ASC`,
    [tripId, agencyId]
  );
  if (tiers.length === 0) return tiers;

  const placeholders = tiers.map(() => "?").join(", ");
  const prices = await query(
    `SELECT * FROM trip_hotel_tier_prices WHERE tier_id IN (${placeholders}) AND agency_id = ? ORDER BY room_type ASC`,
    [...tiers.map((t) => t.id), agencyId]
  );
  return tiers.map((t) => ({ ...t, prices: prices.filter((p) => p.tier_id === t.id) }));
}

async function insertTierPrices(connection, tierId, prices, agencyId) {
  for (const p of prices || []) {
    if (!ROOM_TYPES.includes(p.roomType)) continue;
    if (p.pricePerPerson === undefined || p.pricePerPerson === null || p.pricePerPerson === "") continue;
    await connection.execute(
      `INSERT INTO trip_hotel_tier_prices (tier_id, room_type, price_per_person, seats_limit, agency_id)
       VALUES (?, ?, ?, ?, ?)`,
      [tierId, p.roomType, p.pricePerPerson, p.seatsLimit ?? null, agencyId]
    );
  }
}

export async function createTier(tripId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  await assertOwned("hotels", data.makkahHotelId, agencyId);
  await assertOwned("hotels", data.madinahHotelId, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trip_hotel_tiers
         (trip_id, label, makkah_hotel_id, makkah_board_basis, madinah_hotel_id, madinah_board_basis, sort_order, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        data.label,
        data.makkahHotelId,
        data.makkahBoardBasis,
        data.madinahHotelId,
        data.madinahBoardBasis,
        data.sortOrder || 0,
        agencyId,
      ]
    );
    await insertTierPrices(connection, result.insertId, data.prices, agencyId);
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
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_hotel_tiers", tierId, agencyId);
  await assertOwned("hotels", data.makkahHotelId, agencyId);
  await assertOwned("hotels", data.madinahHotelId, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE trip_hotel_tiers SET label=?, makkah_hotel_id=?, makkah_board_basis=?,
         madinah_hotel_id=?, madinah_board_basis=?, sort_order=? WHERE id=? AND agency_id=?`,
      [
        data.label,
        data.makkahHotelId,
        data.makkahBoardBasis,
        data.madinahHotelId,
        data.madinahBoardBasis,
        data.sortOrder || 0,
        tierId,
        agencyId,
      ]
    );
    await connection.execute(
      `DELETE FROM trip_hotel_tier_prices WHERE tier_id = ? AND agency_id = ?`,
      [tierId, agencyId]
    );
    await insertTierPrices(connection, tierId, data.prices, agencyId);
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
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_hotel_tiers", tierId, agencyId);
  await query(`DELETE FROM trip_hotel_tiers WHERE id = ? AND agency_id = ?`, [tierId, agencyId]);
}

// Appelée DEPUIS la transaction déjà ouverte par createRegistration
// (lib/registrations.js) — verrouille la ligne de prix (tier_id + room_type)
// avec FOR UPDATE avant de compter les inscriptions existantes, exactement
// comme assignRegistrationToRoom verrouille la chambre avant de compter ses
// occupants (lib/roomAssignment.js). Renvoie le prix par personne à utiliser
// comme total_due par défaut.
// excludeRegistrationId (optionnel) : à passer lors d'une MODIFICATION d'une
// inscription déjà existante (updateRegistration, lib/registrations.js) —
// la capacité se recalcule par COMPTE à chaque appel (pas de compteur
// décrémenté), donc exclure l'inscription en cours d'édition de son propre
// décompte suffit à éviter qu'elle se bloque elle-même en gardant le même
// tarif/type de chambre.
export async function reserveTierRoomTypeCapacity(connection, tierId, roomType, excludeRegistrationId) {
  if (!roomType) {
    throw new Error("Le type de chambre est requis pour choisir un tarif d'hébergement");
  }

  const agencyId = await resolveAgencyId();
  const [[priceRow]] = await connection.execute(
    `SELECT id, price_per_person, seats_limit
     FROM trip_hotel_tier_prices
     WHERE tier_id = ? AND room_type = ? AND agency_id = ?
     FOR UPDATE`,
    [tierId, roomType, agencyId]
  );
  if (!priceRow) {
    throw new Error("Ce tarif n'a pas de prix défini pour ce type de chambre");
  }

  if (priceRow.seats_limit !== null) {
    const params = [tierId, roomType, agencyId];
    let sql = `SELECT COUNT(*) AS count FROM registrations
       WHERE selected_tier_id = ? AND preferred_room_type = ? AND agency_id = ? AND status != 'annule'`;
    if (excludeRegistrationId) {
      sql += ` AND id != ?`;
      params.push(excludeRegistrationId);
    }
    const [[{ count }]] = await connection.execute(sql, params);
    if (count >= priceRow.seats_limit) {
      throw new Error("Places épuisées pour ce tarif et ce type de chambre");
    }
  }

  return Number(priceRow.price_per_person);
}
