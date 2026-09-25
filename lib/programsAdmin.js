import { query } from "./db";
import { listDefaultHotelsForProgram } from "./programHotels";

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listAllPrograms() {
  return query(
    `SELECT p.*, COUNT(t.id) AS trips_count
     FROM programs p
     LEFT JOIN trips t ON t.program_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
}

export async function getProgramById(id) {
  const rows = await query(`SELECT * FROM programs WHERE id = ?`, [id]);
  return rows[0] || null;
}

export async function createProgram(data) {
  const result = await query(
    `INSERT INTO programs
       (title, slug, program_type, family, season, theme, short_description, full_description,
        cover_image_url, is_published, meta_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.slug,
      data.programType || "omra",
      data.family || "omra_hajj",
      data.family === "omra_hajj" ? data.season || null : null,
      data.family === "voyage_organise" ? data.theme || null : null,
      data.shortDescription || null,
      data.fullDescription || null,
      data.coverImageUrl || null,
      !!data.isPublished,
      data.metaTitle || null,
      data.metaDescription || null,
    ]
  );
  return result.insertId;
}

export async function updateProgram(id, data) {
  await query(
    `UPDATE programs SET
       title = ?, slug = ?, program_type = ?, family = ?, season = ?, theme = ?,
       short_description = ?, full_description = ?, cover_image_url = ?, is_published = ?,
       meta_title = ?, meta_description = ?
     WHERE id = ?`,
    [
      data.title,
      data.slug,
      data.programType || "omra",
      data.family || "omra_hajj",
      data.family === "omra_hajj" ? data.season || null : null,
      data.family === "voyage_organise" ? data.theme || null : null,
      data.shortDescription || null,
      data.fullDescription || null,
      data.coverImageUrl || null,
      !!data.isPublished,
      data.metaTitle || null,
      data.metaDescription || null,
      id,
    ]
  );
}

export async function deleteProgram(id) {
  await query(`DELETE FROM programs WHERE id = ?`, [id]);
}

// --- Voyages (trips) ---

export async function listTripsForProgram(programId) {
  return query(
    `SELECT t.*, a.name AS airline_name,
            COUNT(reg.id) AS registrations_count
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     LEFT JOIN registrations reg ON reg.trip_id = t.id AND reg.status != 'annule'
     WHERE t.program_id = ?
     GROUP BY t.id
     ORDER BY t.departure_date DESC`,
    [programId]
  );
}

export async function getTripFullById(id) {
  const rows = await query(
    `SELECT t.*, p.title AS program_title
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function createTrip(programId, data) {
  const result = await query(
    `INSERT INTO trips
       (program_id, reference_code, departure_date, return_date, destination_country,
        origin_iata, destination_iata, outbound_layover_iata, return_layover_iata,
        airline_id, total_seats, price_per_person, flight_ticket_price, currency, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      programId,
      data.referenceCode,
      data.departureDate,
      data.returnDate,
      data.destinationCountry || "Arabie Saoudite",
      data.originIata?.toUpperCase() || null,
      data.destinationIata?.toUpperCase() || null,
      data.outboundLayoverIata?.toUpperCase() || null,
      data.returnLayoverIata?.toUpperCase() || null,
      data.airlineId || null,
      data.totalSeats || 0,
      data.pricePerPerson || 0,
      data.flightTicketPrice || null,
      data.currency || "MAD",
      data.status || "planifie",
      data.notes || null,
    ]
  );
  const tripId = result.insertId;

  // Auto-attache les hôtels par défaut du programme (fixés une fois à sa
  // création, voir lib/programHotels.js) — dates par défaut = toute la
  // durée du voyage, ajustables ensuite comme n'importe quel hôtel sur
  // /admin/voyages/[tripId]/hebergement.
  const defaultHotels = await listDefaultHotelsForProgram(programId);
  for (const hotel of defaultHotels) {
    await query(
      `INSERT INTO trip_hotels (trip_id, hotel_id, check_in_date, check_out_date)
       VALUES (?, ?, ?, ?)`,
      [tripId, hotel.id, data.departureDate, data.returnDate]
    );
  }

  return tripId;
}

export async function updateTrip(id, data) {
  await query(
    `UPDATE trips SET
       reference_code = ?, departure_date = ?, return_date = ?, destination_country = ?,
       origin_iata = ?, destination_iata = ?, outbound_layover_iata = ?, return_layover_iata = ?,
       airline_id = ?, total_seats = ?, price_per_person = ?, flight_ticket_price = ?,
       currency = ?, status = ?, notes = ?
     WHERE id = ?`,
    [
      data.referenceCode,
      data.departureDate,
      data.returnDate,
      data.destinationCountry || "Arabie Saoudite",
      data.originIata?.toUpperCase() || null,
      data.destinationIata?.toUpperCase() || null,
      data.outboundLayoverIata?.toUpperCase() || null,
      data.returnLayoverIata?.toUpperCase() || null,
      data.airlineId || null,
      data.totalSeats || 0,
      data.pricePerPerson || 0,
      data.flightTicketPrice || null,
      data.currency || "MAD",
      data.status || "planifie",
      data.notes || null,
      id,
    ]
  );
}

export async function deleteTrip(id) {
  await query(`DELETE FROM trips WHERE id = ?`, [id]);
}
