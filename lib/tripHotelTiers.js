import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";
import { ROOM_TYPES } from "./roomTypes";

// Un tarif rattache UN hôtel par ville, pour autant de villes que le
// programme en compte (Istanbul + Makka + Madina...) — table
// trip_hotel_tier_hotels (migration 043). Les anciennes colonnes
// makkah_hotel_id / madinah_hotel_id de trip_hotel_tiers sont dépréciées.
// Chaque tarif renvoyé porte `hotels` : [{ hotel_id, hotel_name, city,
// board_basis (catalogue), sort_order }], dans l'ordre des villes.
export async function listTiersForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  const tiers = await query(
    `SELECT tht.id, tht.trip_id, tht.label, tht.sort_order, tht.created_at, tht.updated_at
     FROM trip_hotel_tiers tht
     WHERE tht.trip_id = ? AND tht.agency_id = ?
     ORDER BY tht.sort_order ASC, tht.id ASC`,
    [tripId, agencyId]
  );
  if (tiers.length === 0) return tiers;

  const placeholders = tiers.map(() => "?").join(", ");
  const tierIds = tiers.map((t) => t.id);
  const [prices, tierHotels] = await Promise.all([
    query(
      `SELECT * FROM trip_hotel_tier_prices WHERE tier_id IN (${placeholders}) AND agency_id = ? ORDER BY room_type ASC`,
      [...tierIds, agencyId]
    ),
    query(
      `SELECT tth.tier_id, tth.hotel_id, tth.sort_order, ${hotelNameSql("h", locale)} AS hotel_name,
              h.city, h.board_basis
       FROM trip_hotel_tier_hotels tth
       JOIN hotels h ON h.id = tth.hotel_id AND h.agency_id = tth.agency_id
       WHERE tth.tier_id IN (${placeholders}) AND tth.agency_id = ?
       ORDER BY tth.sort_order ASC, tth.id ASC`,
      [...tierIds, agencyId]
    ),
  ]);
  return tiers.map((t) => ({
    ...t,
    hotels: tierHotels.filter((h) => h.tier_id === t.id),
    prices: prices.filter((p) => p.tier_id === t.id),
  }));
}

// `hotels` : [{ hotelId }] dans l'ordre des villes. Au moins un hôtel, un
// seul par ville (hotels.city, comparée sans tenir compte de la casse ni
// des espaces), chacun appartenant à l'agence. Renvoie les lignes prêtes à
// insérer (avec la formule de restauration du catalogue).
async function normalizeTierHotels(hotels, agencyId) {
  const ids = [...new Set((hotels || []).map((h) => Number(h?.hotelId)).filter(Boolean))];
  if (ids.length === 0) {
    const err = new Error("Choisissez au moins un hôtel pour ce tarif");
    err.code = "INVALID_TIER";
    throw err;
  }
  for (const id of ids) await assertOwned("hotels", id, agencyId);
  const rows = await query(
    `SELECT id, city, board_basis FROM hotels WHERE id IN (${ids.map(() => "?").join(", ")}) AND agency_id = ?`,
    [...ids, agencyId]
  );
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const seenCities = new Set();
  return ids.map((id, index) => {
    const hotel = byId.get(id);
    const cityKey = String(hotel.city || "").trim().toLowerCase();
    if (seenCities.has(cityKey)) {
      const err = new Error(`Un seul hôtel par ville dans un tarif (${hotel.city})`);
      err.code = "INVALID_TIER";
      throw err;
    }
    seenCities.add(cityKey);
    return { hotelId: id, boardBasis: hotel.board_basis || "logement_seul", sortOrder: index };
  });
}

async function insertTierHotels(connection, tierId, rows, agencyId) {
  for (const r of rows) {
    await connection.execute(
      `INSERT INTO trip_hotel_tier_hotels (agency_id, tier_id, hotel_id, board_basis, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [agencyId, tierId, r.hotelId, r.boardBasis, r.sortOrder]
    );
  }
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
  const tierHotels = await normalizeTierHotels(data.hotels, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trip_hotel_tiers (trip_id, label, sort_order, agency_id) VALUES (?, ?, ?, ?)`,
      [tripId, data.label, data.sortOrder || 0, agencyId]
    );
    await insertTierHotels(connection, result.insertId, tierHotels, agencyId);
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
  const tierHotels = await normalizeTierHotels(data.hotels, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE trip_hotel_tiers SET label=?, sort_order=? WHERE id=? AND agency_id=?`,
      [data.label, data.sortOrder || 0, tierId, agencyId]
    );
    await connection.execute(
      `DELETE FROM trip_hotel_tier_hotels WHERE tier_id = ? AND agency_id = ?`,
      [tierId, agencyId]
    );
    await insertTierHotels(connection, tierId, tierHotels, agencyId);
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
