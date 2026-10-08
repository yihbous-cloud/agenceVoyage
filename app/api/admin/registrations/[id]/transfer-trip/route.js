import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { transferRegistrationToTrip } from "@/lib/tripTransfer";
import { withNotFound } from "@/lib/apiGuard";

// Transfère l'inscription (ou tout son groupe) vers un autre voyage —
// voir lib/tripTransfer.js pour ce qui est conservé/remis à zéro.
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { targetTripId } = await request.json();

  if (!targetTripId) {
    return NextResponse.json({ message: "Le voyage de destination est requis" }, { status: 400 });
  }

  try {
    const result = await transferRegistrationToTrip(id, targetTripId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

export const PUT = withNotFound(PUT_handler);
