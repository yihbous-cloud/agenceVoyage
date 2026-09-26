import { query } from "./db";
import { getCityByIata } from "./airports";

// Listing par famille pour les deux hubs publics (/omra-hajj, /voyages-organises)
// et pour l'accueil. Chaque programme est apparié à son voyage ouvert le plus
// proche (nt = "nearest trip"), d'où proviennent les champs affichés sur les
// cartes (dates, aéroport de départ, distance au point de repère, places restantes...).
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

  // Point de repère (Haram, Masjid Nabawi...) et distance de l'hôtel le plus
  // proche d'un tel repère, pour le voyage le plus proche — pertinent
  // uniquement pour la famille Omra & Hajj. Les deux sous-requêtes ciblent
  // le même hôtel (le plus proche de son repère) : ordre identique, LIMIT 1.
  const landmarkSelect =
    family === "omra_hajj"
      ? `, (
           SELECT h.landmark_distance_m
           FROM trip_hotels th
           JOIN hotels h ON h.id = th.hotel_id
           WHERE th.trip_id = nt.id AND h.landmark_distance_m IS NOT NULL
           ORDER BY h.landmark_distance_m ASC LIMIT 1
         ) AS landmark_distance_m,
         (
           SELECT h.landmark_name
           FROM trip_hotels th
           JOIN hotels h ON h.id = th.hotel_id
           WHERE th.trip_id = nt.id AND h.landmark_distance_m IS NOT NULL
           ORDER BY h.landmark_distance_m ASC LIMIT 1
         ) AS landmark_name`
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
            LEAST(nt.price_double, nt.price_triple, nt.price_quadruple, nt.price_quintuple) AS starting_price,
            nt.currency,
            (nt.total_seats - COALESCE(reg.taken, 0)) AS seats_remaining
            ${landmarkSelect}
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

// Villes de départ ayant au moins un voyage ouvert/futur publié (les deux
// familles), pour les pages pSEO /villes-depart/[ville] — voir
// PLAN-SEO-GEO-AIO.md §3. Les codes IATA non mappés dans lib/airports.js
// sont exclus : pas de page pour une ville qu'on ne sait pas nommer.
export async function getDepartureCities() {
  const rows = await query(
    `SELECT DISTINCT t.origin_iata
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE p.is_published = TRUE
       AND t.status IN ('ouvert', 'planifie')
       AND t.departure_date >= CURDATE()
       AND t.origin_iata IS NOT NULL`
  );

  return rows
    .map((r) => {
      const info = getCityByIata(r.origin_iata);
      return info ? { iata: r.origin_iata, ...info } : null;
    })
    .filter(Boolean);
}

// Programmes (des deux familles, sauf si filters.family précise) ayant un
// voyage ouvert/futur publié au départ de `iataCode`.
export async function getProgramsByDepartureCity(iataCode, filters = {}) {
  const conditions = ["p.is_published = TRUE", "nt.origin_iata = ?"];
  const whereParams = [iataCode];
  if (filters.family) {
    conditions.push("p.family = ?");
    whereParams.push(filters.family);
  }

  return query(
    `SELECT p.id, p.title, p.slug, p.program_type, p.family, p.season, p.theme,
            p.short_description, p.cover_image_url,
            nt.departure_date AS next_departure_date,
            nt.return_date AS next_return_date,
            nt.origin_iata,
            nt.destination_country,
            LEAST(nt.price_double, nt.price_triple, nt.price_quadruple, nt.price_quintuple) AS starting_price,
            nt.currency,
            (nt.total_seats - COALESCE(reg.taken, 0)) AS seats_remaining
     FROM programs p
     LEFT JOIN trips nt ON nt.id = (
       SELECT t.id FROM trips t
       WHERE t.program_id = p.id
         AND t.status IN ('ouvert', 'planifie')
         AND t.departure_date >= CURDATE()
         AND t.origin_iata = ?
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
     ORDER BY nt.departure_date IS NULL, nt.departure_date ASC`,
    [iataCode, ...whereParams]
  );
}

// Pour la liste déroulante "lier à un programme" du slider admin — seuls
// les programmes publiés ont un intérêt à être mis en avant en une.
export async function listPublishedProgramsForSelect() {
  return query(
    `SELECT id, title, slug, family, cover_image_url
     FROM programs
     WHERE is_published = TRUE
     ORDER BY title ASC`
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
  const trips = await query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date,
            t.destination_country, t.origin_iata, t.destination_iata,
            LEAST(t.price_double, t.price_triple, t.price_quadruple, t.price_quintuple) AS starting_price,
            t.currency,
            t.total_seats, t.status,
            a.name AS airline_name,
            t.total_seats - COALESCE(reg_count.taken, 0) AS seats_remaining,
            landmark_info.min_landmark_distance_m,
            landmark_info.nearest_landmark_name,
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
              GROUP_CONCAT(DISTINCT h.name ORDER BY h.name SEPARATOR ', ') AS hotel_names
       FROM trip_hotels th
       JOIN hotels h ON h.id = th.hotel_id
       GROUP BY th.trip_id
     ) hotel_info ON hotel_info.trip_id = t.id
     LEFT JOIN (
       -- point de repère + distance de l'hôtel le plus proche de son propre
       -- repère (seuls les hôtels avec une distance renseignée comptent) ;
       -- GROUP_CONCAT trié par distance, on ne garde que le premier nom.
       SELECT th.trip_id,
              MIN(h.landmark_distance_m) AS min_landmark_distance_m,
              SUBSTRING_INDEX(
                GROUP_CONCAT(h.landmark_name ORDER BY h.landmark_distance_m ASC SEPARATOR '||'),
                '||', 1
              ) AS nearest_landmark_name
       FROM trip_hotels th
       JOIN hotels h ON h.id = th.hotel_id
       WHERE h.landmark_distance_m IS NOT NULL
       GROUP BY th.trip_id
     ) landmark_info ON landmark_info.trip_id = t.id
     WHERE t.program_id = ?
       AND t.status IN ('ouvert', 'planifie')
       AND t.departure_date >= CURDATE()
     ORDER BY t.departure_date ASC`,
    [programId]
  );

  if (trips.length === 0) return trips;

  // Offres de restauration publiées, par voyage (§ Restauration, voir
  // CLAUDE.md) — requête batch, IN (?) construit à la main : query() passe
  // par pool.execute(), qui n'étend pas automatiquement un tableau en
  // paramètre (voir lib/listGenerators.js pour le même pattern).
  const placeholders = trips.map(() => "?").join(", ");
  const offers = await query(
    `SELECT trip_id, id, title, description FROM trip_meal_offers
     WHERE trip_id IN (${placeholders}) AND is_published = TRUE
     ORDER BY sort_order ASC, id ASC`,
    trips.map((t) => t.id)
  );

  // Si des tarifs d'hébergement (Omra/Hajj, voir CLAUDE.md) sont configurés
  // pour un voyage, le prix public affiché doit refléter le plus bas d'entre
  // eux plutôt que le LEAST() plat calculé ci-dessus — un voyage sans tier
  // garde son starting_price d'origine, aucun changement pour le cas courant.
  const tierPrices = await query(
    `SELECT tht.trip_id, MIN(thtp.price_per_person) AS min_tier_price
     FROM trip_hotel_tiers tht
     JOIN trip_hotel_tier_prices thtp ON thtp.tier_id = tht.id
     WHERE tht.trip_id IN (${placeholders})
     GROUP BY tht.trip_id`,
    trips.map((t) => t.id)
  );
  const minTierPriceByTrip = new Map(tierPrices.map((r) => [r.trip_id, Number(r.min_tier_price)]));

  return trips.map((t) => ({
    ...t,
    starting_price: minTierPriceByTrip.has(t.id) ? minTierPriceByTrip.get(t.id) : t.starting_price,
    meal_offers: offers.filter((o) => o.trip_id === t.id),
  }));
}

export async function getTripById(tripId) {
  const rows = await query(`SELECT * FROM trips WHERE id = ? LIMIT 1`, [tripId]);
  return rows[0] || null;
}
