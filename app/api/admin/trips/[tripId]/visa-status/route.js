import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { bulkSetVisaStatus } from "@/lib/registrations";
import { withNotFound } from "@/lib/apiGuard";

// Changement groupé du statut visa d'un voyage (hors refusés et annulés).
// Même restriction par rôle que le statut visa individuel (direction, suivi).
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (
    !session ||
    !["direction", "suivi"].includes(session.role) ||
    !(await hasPermission(session, "inscriptions.edit"))
  ) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { tripId } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await bulkSetVisaStatus(tripId, body.visaStatus);
    return NextResponse.json(result);
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err?.code === "INVALID_STATUS") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Erreur serveur", detail: err.message }, { status: 500 });
  }
}

export const PUT = withNotFound(PUT_handler);
