import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission, setRolePermissions, deleteRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import { resolveAgencyId } from "@/lib/agencyContext";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit, requestIp } from "@/lib/audit";

// Remplace l'ensemble des permissions d'un rôle. Le nom et la description
// ne sont volontairement pas modifiables ici : renommer un rôle
// invaliderait les sessions déjà ouvertes des comptes qui l'utilisent
// (le rôle est identifié par son nom dans le JWT, pas son id).
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const codes = Array.isArray(body.permissionCodes) ? body.permissionCodes : null;
  if (!codes) {
    return NextResponse.json({ message: "Liste de permissions invalide" }, { status: 400 });
  }

  const agencyId = await resolveAgencyId();
  const roleRows = await query(`SELECT name FROM roles WHERE id = ? AND agency_id = ? LIMIT 1`, [
    id,
    agencyId,
  ]);
  const roleName = roleRows[0]?.name;
  if (!roleName) {
    return NextResponse.json({ message: "Rôle introuvable" }, { status: 404 });
  }

  // Le rôle direction garde de toute façon un accès complet au niveau code
  // (lib/permissions.js) — mais on refuse aussi de vider explicitement ses
  // cases pour que la matrice affichée reste honnête.
  if (roleName === "direction" && codes.length === 0) {
    return NextResponse.json(
      { message: "Le rôle direction doit conserver au moins une permission" },
      { status: 400 }
    );
  }

  const before = await query(`SELECT rp.permission_code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE rp.role_id = ? AND r.agency_id = ?`, [id, agencyId]);
  await setRolePermissions(id, codes);
  await logAudit({ agencyId, staffId: session.id, action: "role.permissions", objectType: "roles", objectId: id,
    before: { role: roleName, permissions: before.map((r) => r.permission_code) }, after: { role: roleName, permissions: codes }, ip: requestIp(request) });
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const agencyId = await resolveAgencyId();
  const roleRows = await query(`SELECT name FROM roles WHERE id = ? AND agency_id = ? LIMIT 1`, [
    id,
    agencyId,
  ]);
  const roleName = roleRows[0]?.name;
  if (!roleName) {
    return NextResponse.json({ message: "Rôle introuvable" }, { status: 404 });
  }
  if (["direction", "ventes", "comptabilite", "suivi"].includes(roleName)) {
    return NextResponse.json(
      { message: "Les rôles fournis avec le système ne peuvent pas être supprimés" },
      { status: 400 }
    );
  }

  try {
    await deleteRole(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
