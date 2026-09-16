import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateStaffUser, deleteStaffUser } from "@/lib/staffUsers";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.fullName?.trim() || !body.email?.trim() || !body.roleId) {
    return NextResponse.json({ message: "Nom, email et rôle sont requis" }, { status: 400 });
  }
  if (body.password && body.password.length < 8) {
    return NextResponse.json(
      { message: "Le mot de passe doit contenir au moins 8 caractères" },
      { status: 400 }
    );
  }

  // Un compte ne peut pas se désactiver ni changer son propre rôle — évite
  // de se retrouver bloqué hors de sa propre session par erreur.
  if (String(session.id) === String(id)) {
    if (body.isActive === false) {
      return NextResponse.json(
        { message: "Vous ne pouvez pas désactiver votre propre compte" },
        { status: 400 }
      );
    }
    if (String(body.roleId) !== String(session.roleId)) {
      return NextResponse.json(
        { message: "Vous ne pouvez pas modifier votre propre rôle" },
        { status: 400 }
      );
    }
  }

  try {
    await updateStaffUser(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Cet email est déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erreur serveur", detail: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  if (String(session.id) === String(id)) {
    return NextResponse.json(
      { message: "Vous ne pouvez pas supprimer votre propre compte" },
      { status: 400 }
    );
  }

  await deleteStaffUser(id);
  return NextResponse.json({ ok: true });
}
