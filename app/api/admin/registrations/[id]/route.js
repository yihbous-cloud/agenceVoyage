import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateRegistration, deleteRegistration } from "@/lib/registrations";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.edit"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // comptabilité et suivi ne peuvent modifier que certains champs
  if (session.role === "comptabilite") {
    const allowed = ["totalDue", "packageType", "discountType", "discountValue", "discountReason", "discountNote"];
    const attempted = Object.keys(body);
    if (attempted.some((key) => !allowed.includes(key))) {
      return NextResponse.json(
        { message: "Le rôle comptabilité ne peut modifier que le montant dû, la formule et la réduction" },
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

  if (body.selectedTierId && !body.preferredRoomType) {
    return NextResponse.json(
      { message: "Le type de chambre est requis pour choisir un tarif d'hébergement" },
      { status: 400 }
    );
  }

  try {
    // Jamais pris du corps de la requête : décidés par la session.
    const payload = { ...body };
    delete payload.canAdminDiscount;
    delete payload.staffId;
    const updated = await updateRegistration(id, {
      ...payload,
      staffId: session.id,
      canAdminDiscount: await hasPermission(session, "remises.admin"),
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err?.code === "DISCOUNT_INVALID") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    if (err?.code === "DISCOUNT_FORBIDDEN") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }
    if (err.code === "ER_WARN_DATA_OUT_OF_RANGE" || err.code === "ER_TRUNCATED_WRONG_VALUE") {
      return NextResponse.json(
        { message: "Valeur invalide (montant ou champ hors limites)" },
        { status: 400 }
      );
    }
    if (
      err.message === "Places épuisées pour ce tarif et ce type de chambre" ||
      err.message === "Ce tarif n'a pas de prix défini pour ce type de chambre" ||
      err.message === "Le type de chambre est requis pour choisir un tarif d'hébergement"
    ) {
      return NextResponse.json({ message: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.delete"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteRegistration(id);
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
