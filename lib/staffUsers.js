import { query } from "./db";
import { hashPassword } from "./auth";

export async function listStaffUsers() {
  return query(
    `SELECT su.id, su.full_name, su.email, su.phone, su.is_active, su.created_at,
            r.id AS role_id, r.name AS role_name
     FROM staff_users su
     JOIN roles r ON r.id = su.role_id
     ORDER BY su.full_name ASC`
  );
}

export async function getStaffUserById(id) {
  const rows = await query(
    `SELECT su.id, su.full_name, su.email, su.phone, su.is_active, su.role_id
     FROM staff_users su
     WHERE su.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createStaffUser(data) {
  const passwordHash = await hashPassword(data.password);
  const result = await query(
    `INSERT INTO staff_users (full_name, email, phone, password_hash, role_id)
     VALUES (?, ?, ?, ?, ?)`,
    [data.fullName, data.email, data.phone || null, passwordHash, data.roleId]
  );
  return result.insertId;
}

// Le mot de passe n'est mis à jour que si un nouveau est fourni (sinon
// l'ancien hash est conservé).
export async function updateStaffUser(id, data) {
  const fields = ["full_name = ?", "email = ?", "phone = ?", "role_id = ?", "is_active = ?"];
  const params = [data.fullName, data.email, data.phone || null, data.roleId, data.isActive];

  if (data.password) {
    fields.push("password_hash = ?");
    params.push(await hashPassword(data.password));
  }

  params.push(id);
  await query(`UPDATE staff_users SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function deleteStaffUser(id) {
  await query(`DELETE FROM staff_users WHERE id = ?`, [id]);
}
