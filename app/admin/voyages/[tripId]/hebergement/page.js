import { notFound } from "next/navigation";
import { listHotels } from "@/lib/hotels";
import {
  getTripSummary,
  listTripHotels,
  listRoomsForTrip,
  listUnassignedRegistrations,
} from "@/lib/roomAssignment";
import { getSession } from "@/lib/session";
import HebergementManager from "./HebergementManager";

export default async function HebergementPage({ params }) {
  const { tripId } = await params;

  const trip = await getTripSummary(tripId);
  if (!trip) {
    notFound();
  }

  const [hotels, tripHotels, rooms, unassigned, session] = await Promise.all([
    listHotels(),
    listTripHotels(tripId),
    listRoomsForTrip(tripId),
    listUnassignedRegistrations(tripId),
    getSession(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Hébergement — {trip.program_title}
        </h1>
        <p className="text-sm text-zinc-500">
          {trip.reference_code} · {new Date(trip.departure_date).toLocaleDateString("fr-FR")}
          {" → "}
          {new Date(trip.return_date).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <HebergementManager
        tripId={trip.id}
        hotels={hotels}
        tripHotels={tripHotels}
        rooms={rooms}
        unassigned={unassigned}
        canManage={["direction", "suivi"].includes(session?.role)}
      />
    </div>
  );
}
