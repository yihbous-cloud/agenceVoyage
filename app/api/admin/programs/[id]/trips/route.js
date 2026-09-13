import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listTripsForProgram, createTrip } from "@/lib/programsAdmin";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const trips = await listTripsForProgram(id);
  return NextResponse.json(trips);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.referenceCode || !body.departureDate || !body.returnDate) {
    return NextResponse.json(
      { message: "referenceCode, departureDate et returnDate sont requis" },
      { status: 400 }
    );
  }

  try {
    const tripId = await createTrip(id, body);
    return NextResponse.json({ id: tripId }, { status: 201 });
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
