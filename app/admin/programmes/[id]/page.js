import { notFound } from "next/navigation";
import Link from "next/link";
import { getProgramById, listTripsForProgram } from "@/lib/programsAdmin";
import { listAllFaqsForProgram } from "@/lib/programFaqs";
import { listAllMealOffersForTrip } from "@/lib/tripMealOffers";
import { listDefaultHotelsForProgram } from "@/lib/programHotels";
import { listTripHotels, listRoomsForTrip } from "@/lib/roomAssignment";
import { listHotels } from "@/lib/hotels";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import InfoCard from "./InfoCard";
import AirportCard from "./AirportCard";
import HotelsCard from "./HotelsCard";
import DisplayCard from "./DisplayCard";
import RestaurationCard from "./RestaurationCard";
import PricingCard from "./PricingCard";
import TripsList from "./TripsList";
import ProgramFaqManager from "./ProgramFaqManager";

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

  const [tripHotels, rooms, mealOffers] = await Promise.all([
    primaryTrip ? listTripHotels(primaryTrip.id) : [],
    primaryTrip ? listRoomsForTrip(primaryTrip.id) : [],
    primaryTrip ? listAllMealOffersForTrip(primaryTrip.id) : [],
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <InfoCard program={program} trip={primaryTrip} canManage={canManageInfo} />
        <AirportCard trip={primaryTrip} airlines={airlines} canManage={canManageTrips} />
        <HotelsCard
          program={program}
          hotels={hotels}
          defaultHotelIds={defaultHotels.map((h) => h.id)}
          tripHotelsCount={tripHotels.length}
          roomsCount={rooms.length}
          primaryTripId={primaryTrip?.id}
          canManage={canManagePrograms}
        />
        <DisplayCard program={program} canManage={canManagePrograms} />
        <RestaurationCard
          tripId={primaryTrip?.id}
          initialOffers={mealOffers}
          canManage={canManageTrips}
        />
        <PricingCard trip={primaryTrip} canManage={canManageTrips} />
      </div>

      <div className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Voyages supplémentaires</h2>
          {canManageTrips && (
            <Link
              href={`/admin/programmes/${id}/voyages/new`}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              + Nouveau voyage
            </Link>
          )}
        </div>
        <TripsList trips={otherTrips} airlines={airlines} canManage={canManageTrips} />
      </div>

      <div className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          FAQ (affichée sur la fiche publique du programme)
        </h2>
        <ProgramFaqManager
          programId={id}
          initialFaqs={faqs}
          canManage={canManagePrograms}
        />
      </div>
    </div>
  );
}
