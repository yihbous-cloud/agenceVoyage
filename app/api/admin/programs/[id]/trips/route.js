import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTripsForProgram, createTrip } from "@/lib/programsAdmin";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const trips = await listTripsForProgram(id);
  return NextResponse.json(trips);
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
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
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
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

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
