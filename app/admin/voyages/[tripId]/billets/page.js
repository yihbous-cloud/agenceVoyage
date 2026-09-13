import { notFound } from "next/navigation";
import {
  getTripForBooking,
  listBookableRegistrations,
  listFlightBookingsForTrip,
} from "@/lib/flightBookings";
import { getDuffelMode } from "@/lib/duffel";
import { getSession } from "@/lib/session";
import FlightBookingManager from "./FlightBookingManager";

export default async function BilletsPage({ params }) {
  const { tripId } = await params;

  const trip = await getTripForBooking(tripId);
  if (!trip) {
    notFound();
  }

  const [bookable, bookings, session] = await Promise.all([
    listBookableRegistrations(tripId),
    listFlightBookingsForTrip(tripId),
    getSession(),
  ]);

  const mode = process.env.DUFFEL_API_KEY ? getDuffelMode() : "non_configure";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Billets d&apos;avion — {trip.program_title}
        </h1>
        <p className="text-sm text-zinc-500">
          {trip.reference_code} · {trip.origin_iata || "?"} → {trip.destination_iata || "?"}
        </p>
      </div>

      {mode === "non_configure" && (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Duffel n&apos;est pas configuré (variable <code>DUFFEL_API_KEY</code>{" "}
          manquante dans <code>.env</code>). La recherche et l&apos;achat de
          billets sont désactivés.
        </p>
      )}
      {mode === "test" && (
        <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          Mode <strong>TEST</strong> Duffel — aucun paiement réel, aucune
          réservation réelle auprès des compagnies.
        </p>
      )}
      {mode === "live" && (
        <p className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          ⚠️ Mode <strong>PRODUCTION</strong> Duffel — les achats effectués ici
          sont réels (paiement et réservation auprès de la compagnie).
        </p>
      )}

      <FlightBookingManager
        tripId={trip.id}
        bookable={bookable}
        bookings={bookings}
        canBook={["direction", "ventes"].includes(session?.role) && mode !== "non_configure"}
      />
    </div>
  );
}
