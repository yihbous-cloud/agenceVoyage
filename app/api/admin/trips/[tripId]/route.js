import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getTripFullById, updateTrip, deleteTrip } from "@/lib/programsAdmin";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { tripId } = await params;
  const trip = await getTripFullById(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }
  return NextResponse.json(trip);
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const body = await request.json();

  // Mise à jour partielle : une carte (Informations, Aéroport, Tarification...)
  // n'envoie que ses propres champs — on ne rend un champ requis que quand
  // il fait partie de cet envoi précis (voir CLAUDE.md).
  if (
    (body.referenceCode !== undefined && !body.referenceCode) ||
    (body.departureDate !== undefined && !body.departureDate) ||
    (body.returnDate !== undefined && !body.returnDate)
  ) {
    return NextResponse.json(
      { message: "referenceCode, departureDate et returnDate ne peuvent pas être vides" },
      { status: 400 }
    );
  }

  try {
    await updateTrip(tripId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Cette référence de voyage existe déjà" },
        { status: 409 }
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
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;

  try {
    await deleteTrip(tripId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return NextResponse.json(
        { message: "Impossible de supprimer : ce voyage a des inscriptions associées" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
