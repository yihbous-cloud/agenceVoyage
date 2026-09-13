import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listTripHotels, addTripHotel } from "@/lib/roomAssignment";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { tripId } = await params;
  const tripHotels = await listTripHotels(tripId);
  return NextResponse.json(tripHotels);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const { hotelId, checkInDate, checkOutDate } = await request.json();

  if (!hotelId || !checkInDate || !checkOutDate) {
    return NextResponse.json(
      { message: "hotelId, checkInDate et checkOutDate sont requis" },
      { status: 400 }
    );
  }

  const id = await addTripHotel(tripId, hotelId, checkInDate, checkOutDate);
  return NextResponse.json({ id }, { status: 201 });
}
