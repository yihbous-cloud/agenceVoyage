import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

export async function listServices() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM services WHERE agency_id = ? ORDER BY name ASC`, [agencyId]);
}

export async function createService({ name, defaultPrice }) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO services (name, default_price, agency_id) VALUES (?, ?, ?)`,
    [name, defaultPrice ?? null, agencyId]
  );
  return result.insertId;
}

export async function updateService(id, { name, defaultPrice }) {
  const agencyId = await resolveAgencyId();
  await assertOwned("services", id, agencyId);
  await query(`UPDATE services SET name = ?, default_price = ? WHERE id = ? AND agency_id = ?`, [
    name,
    defaultPrice ?? null,
    id,
    agencyId,
  ]);
}

export async function deleteService(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("services", id, agencyId);
  await query(`DELETE FROM services WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
