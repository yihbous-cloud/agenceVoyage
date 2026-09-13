import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { createRegistration } from "@/lib/registrations";

export async function POST(request) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "ventes"])) {
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
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
