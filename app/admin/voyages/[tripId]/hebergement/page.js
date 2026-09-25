import { notFound } from "next/navigation";
import { listHotels } from "@/lib/hotels";
import { listDefaultHotelsForProgram } from "@/lib/programHotels";
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

  const [programHotels, allHotels, tripHotels, rooms, unassigned, assigned, session] =
    await Promise.all([
      listDefaultHotelsForProgram(trip.program_id),
      listHotels(),
      listTripHotels(tripId),
      listRoomsForTrip(tripId),
      listUnassignedRegistrations(tripId),
      listAssignedRegistrationsForTrip(tripId),
      getSession(),
    ]);

  // Le menu "Ajouter un hôtel" se limite aux hôtels habituels du programme
  // (choisis à sa création, §3vicies) — sauf si le programme n'en a aucun,
  // auquel cas on retombe sur le catalogue complet plutôt que de bloquer
  // le personnel (§3quattertrigies).
  const hotels = programHotels.length > 0 ? programHotels : allHotels;

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
