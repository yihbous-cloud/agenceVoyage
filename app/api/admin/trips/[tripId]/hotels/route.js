import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTripHotels, addTripHotel, getTripSummary } from "@/lib/roomAssignment";

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
  if (!(await hasPermission(session, "hebergement.manage"))) {
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

  // Les dates du séjour à l'hôtel ne doivent pas sortir des dates du voyage
  // — revalidé côté serveur (le client peut être contourné), même règle
  // que HebergementManager.jsx (voir CLAUDE.md).
  const trip = await getTripSummary(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }
  if (checkInDate < trip.departure_date || checkOutDate > trip.return_date) {
    return NextResponse.json(
      {
        message: `Les dates de l'hôtel doivent rester entre le ${trip.departure_date} et le ${trip.return_date} (dates du voyage)`,
      },
      { status: 400 }
    );
  }
  if (checkInDate >= checkOutDate) {
    return NextResponse.json(
      { message: "La date de check-out doit être après la date de check-in" },
      { status: 400 }
    );
  }

  const id = await addTripHotel(tripId, hotelId, checkInDate, checkOutDate);
  return NextResponse.json({ id }, { status: 201 });
}
