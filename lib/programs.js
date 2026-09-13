import { query } from "./db";

export async function getPublishedPrograms() {
  return query(
    `SELECT p.id, p.title, p.slug, p.program_type, p.short_description, p.cover_image_url,
            MIN(t.departure_date) AS next_departure_date,
            MIN(t.price_per_person) AS starting_price,
            ANY_VALUE(t.currency) AS currency
     FROM programs p
     LEFT JOIN trips t ON t.program_id = p.id
       AND t.status IN ('ouvert', 'planifie')
       AND t.departure_date >= CURDATE()
     WHERE p.is_published = TRUE
     GROUP BY p.id
     ORDER BY next_departure_date IS NULL, next_departure_date ASC`
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
            t.destination_country, t.price_per_person, t.currency,
            t.total_seats, t.status,
            a.name AS airline_name,
            t.total_seats - COALESCE(reg_count.taken, 0) AS seats_remaining
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     LEFT JOIN (
       SELECT trip_id, COUNT(*) AS taken
       FROM registrations
       WHERE status != 'annule'
       GROUP BY trip_id
     ) reg_count ON reg_count.trip_id = t.id
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
