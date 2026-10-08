import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission, getPermissionsMatrix, createRole } from "@/lib/permissions";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit, requestIp } from "@/lib/audit";

async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { roles, permissions, grantedKeys } = await getPermissionsMatrix();
  return NextResponse.json({ roles, permissions, grantedKeys: [...grantedKeys] });
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ message: "Le nom du rôle est requis" }, { status: 400 });
  }

  try {
    const id = await createRole(name, body.description);
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "role.creation", objectType: "roles", objectId: id, after: { name }, ip: requestIp(request) });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ce nom de rôle existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erreur serveur", detail: err.message }, { status: 500 });
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
