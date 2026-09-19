import { notFound } from "next/navigation";
import { listHotels } from "@/lib/hotels";
import {
  getTripSummary,
  listTripHotels,
  listRoomsForTrip,
  listUnassignedRegistrations,
  listAssignedRegistrationsForTrip,
} from "@/lib/roomAssignment";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import HebergementManager from "./HebergementManager";

export default async function HebergementPage({ params }) {
  const { tripId } = await params;

  const trip = await getTripSummary(tripId);
  if (!trip) {
    notFound();
  }

  const [hotels, tripHotels, rooms, unassigned, assigned, session] = await Promise.all([
    listHotels(),
    listTripHotels(tripId),
    listRoomsForTrip(tripId),
    listUnassignedRegistrations(tripId),
    listAssignedRegistrationsForTrip(tripId),
    getSession(),
  ]);

  const canManage = await hasPermission(session, "hebergement.manage");

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
        tripDepartureDate={trip.departure_date}
        tripReturnDate={trip.return_date}
        hotels={hotels}
        tripHotels={tripHotels}
        rooms={rooms}
        unassigned={unassigned}
        assigned={assigned}
        canManage={canManage}
      />
    </div>
  );
}
