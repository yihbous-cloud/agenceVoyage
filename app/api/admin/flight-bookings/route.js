import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getOffer, createOrder } from "@/lib/duffel";
import {
  buildOrderPassengers,
  recordSuccessfulBooking,
  recordFailedBooking,
} from "@/lib/flightBookings";

export async function POST(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "billets.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId, scope, offerId, passengers } = await request.json();

  if (!tripId || !offerId || !Array.isArray(passengers) || passengers.length === 0) {
    return NextResponse.json(
      { message: "tripId, offerId et passengers sont requis" },
      { status: 400 }
    );
  }

  // On re-récupère l'offre au moment de l'achat : elle peut avoir expiré ou
  // changé de prix depuis la recherche, et c'est elle qui porte les
  // identifiants passagers Duffel nécessaires à la commande.
  let offer;
  try {
    offer = await getOffer(offerId);
  } catch (err) {
    return NextResponse.json(
      { message: `Offre introuvable ou expirée : ${err.message}` },
      { status: 409 }
    );
  }

  if (offer.passengers.length !== passengers.length) {
    return NextResponse.json(
      {
        message:
          "Le nombre de passagers ne correspond plus à l'offre (peut-être expirée). Relancez une recherche.",
      },
      { status: 409 }
    );
  }

  const orderPassengers = buildOrderPassengers(offer.passengers, passengers);

  try {
    const order = await createOrder({
      offerId: offer.id,
      totalAmount: offer.total_amount,
      currency: offer.total_currency,
      passengers: orderPassengers,
    });

    const bookingId = await recordSuccessfulBooking({
      tripId,
      scope,
      offer,
      order,
      passengers,
      staffId: session.id,
    });

    return NextResponse.json(
      { id: bookingId, bookingReference: order.booking_reference },
      { status: 201 }
    );
  } catch (err) {
    await recordFailedBooking({
      tripId,
      scope,
      offer,
      errorMessage: err.message,
      staffId: session.id,
    });

    return NextResponse.json(
      { message: `Échec de la commande Duffel : ${err.message}` },
      { status: 502 }
    );
  }
}
