import { query } from "./db";

export async function listServices() {
  return query(`SELECT * FROM services ORDER BY name ASC`);
}

export async function createService({ name, defaultPrice }) {
  const result = await query(
    `INSERT INTO services (name, default_price) VALUES (?, ?)`,
    [name, defaultPrice ?? null]
  );
  return result.insertId;
}

export async function updateService(id, { name, defaultPrice }) {
  await query(`UPDATE services SET name = ?, default_price = ? WHERE id = ?`, [
    name,
    defaultPrice ?? null,
    id,
  ]);
}

export async function deleteService(id) {
  await query(`DELETE FROM services WHERE id = ?`, [id]);
}
