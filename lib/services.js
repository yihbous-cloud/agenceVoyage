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

export async function listRegistrationServices(registrationId) {
  return query(
    `SELECT rs.id, rs.amount, s.id AS service_id, s.name
     FROM registration_services rs
     JOIN services s ON s.id = rs.service_id
     WHERE rs.registration_id = ?
     ORDER BY rs.id ASC`,
    [registrationId]
  );
}

export async function addRegistrationService(registrationId, serviceId, amount) {
  const result = await query(
    `INSERT INTO registration_services (registration_id, service_id, amount) VALUES (?, ?, ?)`,
    [registrationId, serviceId, amount]
  );
  return result.insertId;
}

export async function removeRegistrationService(id) {
  await query(`DELETE FROM registration_services WHERE id = ?`, [id]);
}
