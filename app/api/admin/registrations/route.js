import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { createRegistration } from "@/lib/registrations";
import { getTripById } from "@/lib/programs";
import { isPassportExpiryValid, getMinPassportValidUntil } from "@/lib/passportValidation";

export async function POST(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.create"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { tripId, fullName, phoneWhatsapp, gender } = body;

  if (!tripId || !fullName || !phoneWhatsapp || !gender) {
    return NextResponse.json(
      { message: "tripId, fullName, phoneWhatsapp et gender sont requis" },
      { status: 400 }
    );
  }

  if (body.selectedTierId && !body.preferredRoomType) {
    return NextResponse.json(
      { message: "Le type de chambre est requis pour choisir un tarif d'hébergement" },
      { status: 400 }
    );
  }

  // Règle passeport : doit rester valide au moins 6 mois après la date du
  // voyage — revalidée côté serveur (le client peut être contourné), même
  // règle que PUT .../registrations/[id]/traveler (voir CLAUDE.md §3nonies).
  if (body.passportExpiryDate) {
    const trip = await getTripById(tripId);
    if (!isPassportExpiryValid(body.passportExpiryDate, trip?.departure_date)) {
      const { reference } = getMinPassportValidUntil(trip?.departure_date);
      return NextResponse.json(
        {
          message: `Le passeport doit rester valide au moins 6 mois après le ${reference.toLocaleDateString("fr-FR")}`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const result = await createRegistration({
      ...body,
      registeredByStaffId: session.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Ce voyageur est déjà inscrit à ce voyage" },
        { status: 409 }
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
