import { query } from "./db";

// Listing par famille pour les deux hubs publics (/omra-hajj, /voyages-organises)
// et pour l'accueil. Chaque programme est apparié à son voyage ouvert le plus
// proche (nt = "nearest trip"), d'où proviennent les champs affichés sur les
// cartes (dates, aéroport de départ, distance Haram, places restantes...).
//
// filters:
//   - omra_hajj: { season, limit }
//   - voyage_organise: { theme, destination, limit }
export async function getProgramsByFamily(family, filters = {}) {
  let nearestTripFilterExtra = "";
  const nearestTripParams = [];
  if (family === "voyage_organise" && filters.destination) {
    nearestTripFilterExtra = " AND t.destination_country LIKE ?";
    nearestTripParams.push(`%${filters.destination}%`);
  }

  const conditions = ["p.is_published = TRUE", "p.family = ?"];
  const whereParams = [family];
  if (family === "omra_hajj" && filters.season) {
    conditions.push("p.season = ?");
    whereParams.push(filters.season);
  }
  if (family === "voyage_organise" && filters.theme) {
    conditions.push("p.theme = ?");
    whereParams.push(filters.theme);
  }
  if (filters.destination) {
    // Un voyage correspondant au filtre destination doit exister, sinon on
    // masque le programme plutôt que d'afficher une carte sans départ.
    conditions.push("nt.id IS NOT NULL");
  }

  // Distance à la Haram de l'hôtel du voyage le plus proche — pertinent
  // uniquement pour la famille Omra & Hajj.
  const distanceHaramSelect =
    family === "omra_hajj"
      ? `, (
           SELECT MIN(h.distance_to_haram_m)
           FROM trip_hotels th
           JOIN hotels h ON h.id = th.hotel_id
           WHERE th.trip_id = nt.id
         ) AS distance_haram_m`
      : "";

  const limitClause = filters.limit ? `LIMIT ${Number(filters.limit)}` : "";

  const params = [...nearestTripParams, ...whereParams];

  return query(
    `SELECT p.id, p.title, p.slug, p.program_type, p.family, p.season, p.theme,
            p.short_description, p.cover_image_url,
            nt.departure_date AS next_departure_date,
            nt.return_date AS next_return_date,
            nt.origin_iata,
            nt.destination_country,
            nt.price_per_person AS starting_price,
            nt.currency,
            (nt.total_seats - COALESCE(reg.taken, 0)) AS seats_remaining
            ${distanceHaramSelect}
     FROM programs p
     LEFT JOIN trips nt ON nt.id = (
       SELECT t.id FROM trips t
       WHERE t.program_id = p.id
         AND t.status IN ('ouvert', 'planifie')
         AND t.departure_date >= CURDATE()
         ${nearestTripFilterExtra}
       ORDER BY t.departure_date ASC
       LIMIT 1
     )
     LEFT JOIN (
       SELECT trip_id, COUNT(*) AS taken
       FROM registrations
       WHERE status != 'annule'
       GROUP BY trip_id
     ) reg ON reg.trip_id = nt.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY nt.departure_date IS NULL, nt.departure_date ASC
     ${limitClause}`,
    params
  );
}

export async function getProgramBySlug(slug) {
  const rows = await query(
    `SELECT * FROM programs WHERE slug = ? AND is_published = TRUE LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

export async function getOpenTripsForProgram(programId) {
  return query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date,
            t.destination_country, t.origin_iata, t.destination_iata,
            t.price_per_person, t.currency,
            t.total_seats, t.status,
            a.name AS airline_name,
            t.total_seats - COALESCE(reg_count.taken, 0) AS seats_remaining,
            hotel_info.min_distance_to_haram_m,
            hotel_info.hotel_names
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     LEFT JOIN (
       SELECT trip_id, COUNT(*) AS taken
       FROM registrations
       WHERE status != 'annule'
       GROUP BY trip_id
     ) reg_count ON reg_count.trip_id = t.id
     LEFT JOIN (
       SELECT th.trip_id,
              MIN(h.distance_to_haram_m) AS min_distance_to_haram_m,
              GROUP_CONCAT(DISTINCT h.name ORDER BY h.name SEPARATOR ', ') AS hotel_names
       FROM trip_hotels th
       JOIN hotels h ON h.id = th.hotel_id
       GROUP BY th.trip_id
     ) hotel_info ON hotel_info.trip_id = t.id
     WHERE t.program_id = ?
       AND t.status IN ('ouvert', 'planifie')
       AND t.departure_date >= CURDATE()
     ORDER BY t.departure_date ASC`,
    [programId]
  );
}

export async function getTripById(tripId) {
  const rows = await query(`SELECT * FROM trips WHERE id = ? LIMIT 1`, [tripId]);
  return rows[0] || null;
}
