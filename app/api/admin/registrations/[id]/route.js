import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { updateRegistration, deleteRegistration } from "@/lib/registrations";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "ventes", "comptabilite", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // comptabilité et suivi ne peuvent modifier que certains champs
  if (session.role === "comptabilite") {
    const allowed = ["totalDue"];
    const attempted = Object.keys(body);
    if (attempted.some((key) => !allowed.includes(key))) {
      return NextResponse.json(
        { message: "Le rôle comptabilité ne peut modifier que le montant dû" },
        { status: 403 }
      );
    }
  }
  if (session.role === "suivi") {
    const allowed = ["visaStatus", "notes"];
    const attempted = Object.keys(body);
    if (attempted.some((key) => !allowed.includes(key))) {
      return NextResponse.json(
        { message: "Le rôle suivi ne peut modifier que le visa et les notes" },
        { status: 403 }
      );
    }
  }

  try {
    const updated = await updateRegistration(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    if (err.code === "ER_WARN_DATA_OUT_OF_RANGE" || err.code === "ER_TRUNCATED_WRONG_VALUE") {
      return NextResponse.json(
        { message: "Valeur invalide (montant ou champ hors limites)" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "ventes"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteRegistration(id);
  return NextResponse.json({ ok: true });
}
