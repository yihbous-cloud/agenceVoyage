import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listStaffUsers, createStaffUser } from "@/lib/staffUsers";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit, requestIp } from "@/lib/audit";

async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const users = await listStaffUsers();
  return NextResponse.json(users);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.fullName?.trim() || !body.email?.trim() || !body.password || !body.roleId) {
    return NextResponse.json(
      { message: "Nom, email, mot de passe et rôle sont requis" },
      { status: 400 }
    );
  }
  if (body.password.length < 8) {
    return NextResponse.json(
      { message: "Le mot de passe doit contenir au moins 8 caractères" },
      { status: 400 }
    );
  }

  try {
    const id = await createStaffUser(body);
    await logAudit({ agencyId: session.agencyId, staffId: session.id, action: "utilisateur.creation", objectType: "staff_users", objectId: id,
      after: { fullName: body.fullName, email: body.email, roleId: body.roleId }, ip: requestIp(request) });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Cet email est déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erreur serveur", detail: err.message }, { status: 500 });
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
