import { query, getPool } from "./db";

// Catalogue de permissions dynamique (table `permissions` + `role_permissions`,
// voir migration 007_add_permissions.sql). Remplace les listes de rôles codées
// en dur (`requireRole(session, ["direction", "ventes"])`) par un contrôle
// éditable depuis /admin/parametres/roles.
//
// ⚠️ Le rôle `direction` a toujours accès à tout, quel que soit le contenu de
// role_permissions — filet de sécurité pour ne jamais se retrouver bloqué
// hors du système après une mauvaise manipulation des permissions.
export async function hasPermission(session, code) {
  if (!session) return false;
  if (session.role === "direction") return true;

  // Rôles propres à chaque agence (multi-agences, CLAUDE.md §3sexvicies) :
  // un rôle du même nom dans une autre agence ne doit jamais matcher.
  const rows = await query(
    `SELECT 1 FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = ? AND r.agency_id = ? AND rp.permission_code = ?
     LIMIT 1`,
    [session.role, session.agencyId, code]
  );
  return rows.length > 0;
}

export async function listPermissions() {
  return query(`SELECT * FROM permissions ORDER BY category, sort_order`);
}

export async function listRoles() {
  return query(`SELECT * FROM roles ORDER BY id`);
}

// Vue d'ensemble pour la page d'administration des rôles : tous les rôles,
// toutes les permissions, et l'ensemble des cases actuellement cochées.
export async function getPermissionsMatrix() {
  const [roles, permissions, grants] = await Promise.all([
    listRoles(),
    listPermissions(),
    query(`SELECT role_id, permission_code FROM role_permissions`),
  ]);

  const grantedKeys = new Set(grants.map((g) => `${g.role_id}:${g.permission_code}`));
  return { roles, permissions, grantedKeys };
}

export async function createRole(name, description) {
  const result = await query(
    `INSERT INTO roles (name, description) VALUES (?, ?)`,
    [name, description || null]
  );
  return result.insertId;
}

// Un rôle utilisé par au moins un compte ne peut pas être supprimé (évite de
// laisser des comptes orphelins ou de casser leur session).
export async function deleteRole(roleId) {
  const inUse = await query(`SELECT id FROM staff_users WHERE role_id = ? LIMIT 1`, [roleId]);
  if (inUse.length > 0) {
    throw new Error("Ce rôle est encore assigné à au moins un compte.");
  }
  await query(`DELETE FROM roles WHERE id = ?`, [roleId]);
}

// Remplace intégralement l'ensemble des permissions d'un rôle par la
// nouvelle liste fournie (coché/décoché dans la matrice admin).
export async function setRolePermissions(roleId, permissionCodes) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
    if (permissionCodes.length > 0) {
      const placeholders = permissionCodes.map(() => "(?, ?)").join(", ");
      const params = permissionCodes.flatMap((code) => [roleId, code]);
      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_code) VALUES ${placeholders}`,
        params
      );
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
