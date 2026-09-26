import { notFound } from "next/navigation";
import { getProgramById, listTripsForProgram } from "@/lib/programsAdmin";
import { listAllFaqsForProgram } from "@/lib/programFaqs";
import { listAllMealOffersForTrip } from "@/lib/tripMealOffers";
import { listTiersForTrip } from "@/lib/tripHotelTiers";
import { listDefaultHotelsForProgram } from "@/lib/programHotels";
import { listTripHotels, listRoomsForTrip } from "@/lib/roomAssignment";
import { listHotels } from "@/lib/hotels";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import ProgramManagerGrid from "./ProgramManagerGrid";

export default async function ProgramDetailPage({ params }) {
  const { id } = await params;

  const [program, trips, faqs, defaultHotels, hotels, airlines, session] = await Promise.all([
    getProgramById(id),
    listTripsForProgram(id),
    listAllFaqsForProgram(id),
    listDefaultHotelsForProgram(id),
    listHotels(),
    listAirlines(),
    getSession(),
  ]);

  if (!program) {
    notFound();
  }

  // Voyage principal : le plus ancien par date de départ (cas courant, un
  // seul voyage) — les cartes Aéroport/Hôtels/Tarification/Restauration
  // portent sur lui ; les voyages supplémentaires restent gérés via la
  // liste "Voyages" plus bas (voir CLAUDE.md).
  const primaryTrip =
    [...trips].sort(
      (a, b) => new Date(a.departure_date) - new Date(b.departure_date) || a.id - b.id
    )[0] || null;

  const [tripHotels, rooms, mealOffers, tiers] = await Promise.all([
    primaryTrip ? listTripHotels(primaryTrip.id) : [],
    primaryTrip ? listRoomsForTrip(primaryTrip.id) : [],
    primaryTrip ? listAllMealOffersForTrip(primaryTrip.id) : [],
    primaryTrip && program.family === "omra_hajj" ? listTiersForTrip(primaryTrip.id) : [],
  ]);

  const [canManagePrograms, canManageTrips] = await Promise.all([
    hasPermission(session, "programmes.manage"),
    hasPermission(session, "voyages.manage"),
  ]);
  const canManageInfo = canManagePrograms && canManageTrips;

  const otherTrips = trips.filter((t) => t.id !== primaryTrip?.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{program.title}</h1>

      <ProgramManagerGrid
        programId={id}
        program={program}
        primaryTrip={primaryTrip}
        airlines={airlines}
        hotels={hotels}
        defaultHotelIds={defaultHotels.map((h) => h.id)}
        tripHotelsCount={tripHotels.length}
        roomsCount={rooms.length}
        mealOffers={mealOffers}
        tiers={tiers}
        otherTrips={otherTrips}
        faqs={faqs}
        canManagePrograms={canManagePrograms}
        canManageTrips={canManageTrips}
        canManageInfo={canManageInfo}
      />
    </div>
  );
}
