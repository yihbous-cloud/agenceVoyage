import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

export async function listAirlines() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM airlines WHERE agency_id = ? ORDER BY name ASC`, [agencyId]);
}

// Voyages rattachés à chaque compagnie, avec leur PNR réel (saisi sur le
// voyage, carte Aéroport) — alimente la colonne PNR de /admin/airlines.
export async function listTripsWithPnrByAirline() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT t.id, t.airline_id, t.reference_code, t.departure_date, t.pnr, p.id AS program_id, p.title
     FROM trips t JOIN programs p ON p.id = t.program_id
     WHERE t.airline_id IS NOT NULL AND t.agency_id = ?
     ORDER BY t.departure_date ASC`,
    [agencyId]
  );
}

export async function createAirline(data) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO airlines (name, iata_code, export_template_key, is_active, agency_id)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.iataCode || null, data.exportTemplateKey || "generic_template", true, agencyId]
  );
  return result.insertId;
}

export async function updateAirline(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("airlines", id, agencyId);
  await query(
    `UPDATE airlines SET name = ?, iata_code = ?, export_template_key = ?, is_active = ?
     WHERE id = ? AND agency_id = ?`,
    [
      data.name,
      data.iataCode || null,
      data.exportTemplateKey || "generic_template",
      data.isActive !== false,
      id,
      agencyId,
    ]
  );
}

export async function deleteAirline(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("airlines", id, agencyId);
  await query(`DELETE FROM airlines WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
