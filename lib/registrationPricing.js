import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { pickTripPrice, pickTierPrice, computeRegistrationPrice, DISCOUNT_TYPES, PACKAGE_TYPES, DISCOUNT_REASONS } from "./roomTypes";

// Prix d'une inscription = formule achetée (complet / vol seul / hébergement
// seul) − réduction (montant, %, gratuité) — CLAUDE.md. Le montant dû
// (registrations.total_due) en découle dès qu'un de ces éléments change.

function makeError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Prix du programme complet pour un voyage / tarif / type de chambre.
async function fullPriceFor(exec, agencyId, { tripId, tierId, roomType }) {
  const [trip] = await exec(
    `SELECT price_double, price_triple, price_quadruple, price_quintuple, price_flight_only
     FROM trips WHERE id = ? AND agency_id = ?`,
    [tripId, agencyId]
  );
  if (!trip) return { fullPrice: 0, flightOnlyPrice: 0 };
  let fullPrice = null;
  if (tierId) {
    const rows = await exec(
      `SELECT room_type, price_per_person FROM trip_hotel_tier_prices WHERE tier_id = ? AND agency_id = ?`,
      [tierId, agencyId]
    );
    fullPrice = pickTierPrice(rows, roomType);
  }
  if (fullPrice === null) fullPrice = pickTripPrice(trip, roomType);
  return { fullPrice, flightOnlyPrice: trip.price_flight_only };
}

// exec : `query` (pool) ou une connexion en transaction (connection.execute).
export function connectionExec(connection) {
  return async (sql, params) => (await connection.execute(sql, params))[0];
}

export async function computePriceFor(input, { connection } = {}) {
  const agencyId = await resolveAgencyId();
  const exec = connection ? connectionExec(connection) : query;
  const { fullPrice, flightOnlyPrice } = await fullPriceFor(exec, agencyId, input);
  return computeRegistrationPrice({
    fullPrice,
    flightOnlyPrice,
    packageType: input.packageType || "complet",
    discountType: input.discountType || "aucune",
    discountValue: input.discountValue,
  });
}

// Contrôle d'une réduction saisie : motif obligatoire ; sans la permission
// `remises.admin`, pas de gratuité et une réduction ≤ plafond du voyage
// (plafond non défini = réduction réservée à l'administrateur). Le plafond
// n'est jamais renvoyé dans le message.
export async function assertDiscountAllowed({ tripId, packageType, discountType, discountValue, discountReason, discountAmount, canAdmin }, { connection } = {}) {
  if (packageType && !PACKAGE_TYPES.includes(packageType)) throw makeError("Formule invalide", "DISCOUNT_INVALID");
  if (!DISCOUNT_TYPES.includes(discountType || "aucune")) throw makeError("Type de réduction invalide", "DISCOUNT_INVALID");
  if (!discountType || discountType === "aucune") return;
  if (discountType !== "gratuite" && !(Number(discountValue) > 0)) {
    throw makeError("Indiquez la valeur de la réduction", "DISCOUNT_INVALID");
  }
  if (discountType === "pourcentage" && Number(discountValue) > 100) {
    throw makeError("Une réduction ne peut pas dépasser 100 %", "DISCOUNT_INVALID");
  }
  if (!discountReason || !DISCOUNT_REASONS.includes(discountReason)) {
    throw makeError("Le motif de la réduction est obligatoire", "DISCOUNT_INVALID");
  }
  if (canAdmin) return;
  if (discountType === "gratuite") {
    throw makeError("Seul l'administrateur peut accorder une gratuité totale", "DISCOUNT_FORBIDDEN");
  }
  const agencyId = await resolveAgencyId();
  const exec = connection ? connectionExec(connection) : query;
  const [trip] = await exec(`SELECT discount_cap FROM trips WHERE id = ? AND agency_id = ?`, [tripId, agencyId]);
  const cap = trip?.discount_cap;
  if (cap === null || cap === undefined || Number(discountAmount) > Number(cap)) {
    throw makeError(
      "Cette réduction dépasse le plafond autorisé pour ce programme : demandez l'accord de l'administrateur",
      "DISCOUNT_FORBIDDEN"
    );
  }
}

// Recalcule et enregistre prix de base, réduction et montant dû d'une
// inscription à partir de ses champs actuels. Renvoie le prix net.
export async function repriceRegistration(registrationId) {
  const agencyId = await resolveAgencyId();
  const [reg] = await query(
    `SELECT trip_id, selected_tier_id, preferred_room_type, package_type, discount_type, discount_value
     FROM registrations WHERE id = ? AND agency_id = ?`,
    [registrationId, agencyId]
  );
  if (!reg) return 0;
  const price = await computePriceFor({
    tripId: reg.trip_id,
    tierId: reg.selected_tier_id,
    roomType: reg.preferred_room_type,
    packageType: reg.package_type,
    discountType: reg.discount_type,
    discountValue: reg.discount_value,
  });
  await query(
    `UPDATE registrations SET base_price = ?, discount_amount = ?, total_due = ? WHERE id = ? AND agency_id = ?`,
    [price.basePrice, price.discountAmount, price.netPrice, registrationId, agencyId]
  );
  return price.netPrice;
}

// Plafond de réduction d'un voyage — à n'appeler que pour l'administrateur.
export async function getTripDiscountCap(tripId) {
  const agencyId = await resolveAgencyId();
  const [trip] = await query(`SELECT discount_cap FROM trips WHERE id = ? AND agency_id = ?`, [tripId, agencyId]);
  return trip?.discount_cap ?? null;
}
