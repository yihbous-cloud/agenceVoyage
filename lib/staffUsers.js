import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { hashPassword } from "./auth";

export async function listStaffUsers() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT su.id, su.full_name, su.email, su.phone, su.is_active, su.created_at,
            su.totp_enabled_at IS NOT NULL AS totp_enabled, su.locked_until > UTC_TIMESTAMP() AS locked, su.last_login_at,
            r.id AS role_id, r.name AS role_name
     FROM staff_users su
     JOIN roles r ON r.id = su.role_id
     WHERE su.agency_id = ?
     ORDER BY su.full_name ASC`,
    [agencyId]
  );
}

export async function getStaffUserById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT su.id, su.full_name, su.email, su.phone, su.is_active, su.role_id
     FROM staff_users su
     WHERE su.id = ? AND su.agency_id = ?
     LIMIT 1`,
    [id, agencyId]
  );
  return rows[0] || null;
}

export async function createStaffUser(data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("roles", data.roleId, agencyId);
  const passwordHash = await hashPassword(data.password);
  const result = await query(
    `INSERT INTO staff_users (full_name, email, phone, password_hash, role_id, agency_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.fullName, data.email, data.phone || null, passwordHash, data.roleId, agencyId]
  );
  return result.insertId;
}

// Le mot de passe n'est mis à jour que si un nouveau est fourni (sinon
// l'ancien hash est conservé).
export async function updateStaffUser(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("staff_users", id, agencyId);
  await assertOwned("roles", data.roleId, agencyId);
  const fields = ["full_name = ?", "email = ?", "phone = ?", "role_id = ?", "is_active = ?"];
  const params = [data.fullName, data.email, data.phone || null, data.roleId, data.isActive];

  if (data.password) {
    fields.push("password_hash = ?");
    params.push(await hashPassword(data.password));
  }

  params.push(id, agencyId);
  await query(`UPDATE staff_users SET ${fields.join(", ")} WHERE id = ? AND agency_id = ?`, params);
}

export async function deleteStaffUser(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("staff_users", id, agencyId);
  await query(`DELETE FROM staff_users WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
