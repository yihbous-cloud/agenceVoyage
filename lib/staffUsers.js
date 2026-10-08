import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { hashPassword } from "./auth";

export async function listStaffUsers() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT su.id, su.full_name, su.email, su.phone, su.is_active, su.created_at,
            su.totp_enabled_at IS NOT NULL AS totp_enabled, su.locked_until > UTC_TIMESTAMP() AS locked, su.last_login_at,
            su.approval_status, su.reviewed_at, reviewer.full_name AS reviewer_name,
            r.id AS role_id, r.name AS role_name
     FROM staff_users su
     JOIN roles r ON r.id = su.role_id
     LEFT JOIN staff_users reviewer ON reviewer.id = su.reviewed_by_staff_id AND reviewer.agency_id = su.agency_id
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

// --- Demandes de compte (migration 041) ------------------------------------
// Un membre de l'équipe demande son compte depuis /admin/demande-compte : le
// compte est créé INACTIF au statut « en_attente » et ne peut pas se
// connecter tant qu'un administrateur (utilisateurs.manage) ne l'a pas validé.

// Le rôle n'est PAS choisi par le demandeur : l'administrateur le fixe à la
// validation. role_id étant obligatoire, la demande reçoit en attendant un
// rôle « réservé » de l'agence (le premier qui n'est pas direction) — sans
// effet tant que le compte est inactif.
export async function createSignupRequest(data) {
  const agencyId = await resolveAgencyId();
  const roles = await query(
    `SELECT id FROM roles WHERE agency_id = ? ORDER BY name = 'direction', id LIMIT 1`,
    [agencyId]
  );
  if (!roles[0]) throw new Error("Aucun rôle défini pour cette agence");
  const passwordHash = await hashPassword(data.password);
  const result = await query(
    `INSERT INTO staff_users (full_name, email, phone, password_hash, role_id, is_active, approval_status, agency_id)
     VALUES (?, ?, ?, ?, ?, FALSE, 'en_attente', ?)`,
    [data.fullName, data.email, data.phone || null, passwordHash, roles[0].id, agencyId]
  );
  return result.insertId;
}

export async function countPendingSignupRequests() {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT COUNT(*) AS n FROM staff_users WHERE agency_id = ? AND approval_status = 'en_attente'`,
    [agencyId]
  );
  return Number(rows[0]?.n || 0);
}

// decision = "valider" (active le compte avec le rôle choisi par
// l'administrateur) ou "refuser" (le compte reste inactif ; la personne voit
// « demande refusée » à la connexion). Un compte déjà validé n'est jamais
// repassé par ici (désactivation = formulaire « Modifier » habituel).
export async function reviewSignupRequest(id, { decision, roleId, reviewerId }) {
  const agencyId = await resolveAgencyId();
  await assertOwned("staff_users", id, agencyId);
  const rows = await query(`SELECT approval_status FROM staff_users WHERE id = ? AND agency_id = ? LIMIT 1`, [id, agencyId]);
  if (rows[0]?.approval_status === "valide") {
    const err = new Error("Ce compte est déjà validé");
    err.code = "ALREADY_VALIDATED";
    throw err;
  }

  if (decision === "valider") {
    await assertOwned("roles", roleId, agencyId);
    await query(
      `UPDATE staff_users
       SET approval_status = 'valide', is_active = TRUE, role_id = ?, reviewed_by_staff_id = ?, reviewed_at = UTC_TIMESTAMP(),
           failed_login_count = 0, locked_until = NULL
       WHERE id = ? AND agency_id = ?`,
      [roleId, reviewerId || null, id, agencyId]
    );
  } else if (decision === "refuser") {
    await query(
      `UPDATE staff_users
       SET approval_status = 'refuse', is_active = FALSE, reviewed_by_staff_id = ?, reviewed_at = UTC_TIMESTAMP()
       WHERE id = ? AND agency_id = ?`,
      [reviewerId || null, id, agencyId]
    );
  } else {
    throw new Error("Décision inconnue");
  }
}
