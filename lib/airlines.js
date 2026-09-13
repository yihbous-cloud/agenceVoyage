import { query } from "./db";

export async function listAirlines() {
  return query(`SELECT * FROM airlines ORDER BY name ASC`);
}

export async function createAirline(data) {
  const result = await query(
    `INSERT INTO airlines (name, iata_code, export_template_key, is_active)
     VALUES (?, ?, ?, ?)`,
    [data.name, data.iataCode || null, data.exportTemplateKey || "generic_template", true]
  );
  return result.insertId;
}

export async function updateAirline(id, data) {
  await query(
    `UPDATE airlines SET name = ?, iata_code = ?, export_template_key = ?, is_active = ?
     WHERE id = ?`,
    [
      data.name,
      data.iataCode || null,
      data.exportTemplateKey || "generic_template",
      data.isActive !== false,
      id,
    ]
  );
}

export async function deleteAirline(id) {
  await query(`DELETE FROM airlines WHERE id = ?`, [id]);
}
