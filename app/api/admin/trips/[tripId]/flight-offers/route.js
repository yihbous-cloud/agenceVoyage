import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getTripForBooking } from "@/lib/flightBookings";
import { searchOffers, getDuffelMode } from "@/lib/duffel";

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "billets.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const { registrationIds } = await request.json();

  if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
    return NextResponse.json(
      { message: "Sélectionnez au moins un voyageur" },
      { status: 400 }
    );
  }

  const trip = await getTripForBooking(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  if (!trip.origin_iata || !trip.destination_iata) {
    return NextResponse.json(
      {
        message:
          "Aéroports de départ/arrivée manquants pour ce voyage. Renseignez-les dans la fiche voyage.",
      },
      { status: 400 }
    );
  }

  try {
    const offers = await searchOffers({
      originIata: trip.origin_iata,
      destinationIata: trip.destination_iata,
      returnOriginIata: trip.return_origin_iata,
      returnDestinationIata: trip.return_destination_iata,
      departureDate: trip.departure_date,
      returnDate: trip.return_date,
      passengerCount: registrationIds.length,
    });

    const simplifiedOffers = offers.map((o) => ({
      id: o.id,
      totalAmount: o.total_amount,
      totalCurrency: o.total_currency,
      owner: o.owner?.name,
      slices: o.slices.map((s) => ({
        origin: s.origin?.iata_code,
        destination: s.destination?.iata_code,
        departingAt: s.segments?.[0]?.departing_at,
        arrivingAt: s.segments?.[s.segments.length - 1]?.arriving_at,
        segmentsCount: s.segments?.length,
      })),
    }));

    return NextResponse.json({ offers: simplifiedOffers, mode: getDuffelMode() });
  } catch (err) {
    return NextResponse.json(
      { message: err.message || "Erreur lors de la recherche Duffel" },
      { status: 502 }
    );
  }
}
