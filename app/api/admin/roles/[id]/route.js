import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission, setRolePermissions, deleteRole } from "@/lib/permissions";
import { query } from "@/lib/db";

// Remplace l'ensemble des permissions d'un rôle. Le nom et la description
// ne sont volontairement pas modifiables ici : renommer un rôle
// invaliderait les sessions déjà ouvertes des comptes qui l'utilisent
// (le rôle est identifié par son nom dans le JWT, pas son id).
export async function PUT(request, { params }) {
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

  const roleRows = await query(`SELECT name FROM roles WHERE id = ? LIMIT 1`, [id]);
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

  await setRolePermissions(id, codes);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const roleRows = await query(`SELECT name FROM roles WHERE id = ? LIMIT 1`, [id]);
  const roleName = roleRows[0]?.name;
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
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
