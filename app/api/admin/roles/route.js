import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission, getPermissionsMatrix, createRole } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!(await hasPermission(session, "roles.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { roles, permissions, grantedKeys } = await getPermissionsMatrix();
  return NextResponse.json({ roles, permissions, grantedKeys: [...grantedKeys] });
}

export async function POST(request) {
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
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ce nom de rôle existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erreur serveur", detail: err.message }, { status: 500 });
  }
}
