import { notFound } from "next/navigation";
import { getProgramById, listTripsForProgram } from "@/lib/programsAdmin";
import { listAllFaqsForProgram } from "@/lib/programFaqs";
import { listTiersForTrip } from "@/lib/tripHotelTiers";
import { listDefaultHotelsForProgram } from "@/lib/programHotels";
import { listTripHotels, listRoomsForTrip } from "@/lib/roomAssignment";
import { listHotels } from "@/lib/hotels";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listExpensesForTrip } from "@/lib/tripExpenses";
import ProgramManagerGrid from "./ProgramManagerGrid";
import { getTripDiscountCap } from "@/lib/registrationPricing";

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
  // seul voyage) — les cartes Aéroport/Hôtels portent sur lui (voir CLAUDE.md).
  const primaryTrip =
    [...trips].sort(
      (a, b) => new Date(a.departure_date) - new Date(b.departure_date) || a.id - b.id
    )[0] || null;

  const [tripHotels, rooms, tiers] = await Promise.all([
    primaryTrip ? listTripHotels(primaryTrip.id) : [],
    primaryTrip ? listRoomsForTrip(primaryTrip.id) : [],
    primaryTrip && program.family === "omra_hajj" ? listTiersForTrip(primaryTrip.id) : [],
  ]);

  const [canManagePrograms, canManageTrips, canViewCharges, canManageCharges] = await Promise.all([
    hasPermission(session, "programmes.manage"),
    hasPermission(session, "voyages.manage"),
    hasPermission(session, "charges.view"),
    hasPermission(session, "charges.manage"),
  ]);
  // Charges financières (migration 035) : chargées seulement si la carte est
  // visible pour ce rôle (charges.view ou charges.manage).
  const showCharges = Boolean(primaryTrip) && (canViewCharges || canManageCharges);
  const expenses = showCharges ? await listExpensesForTrip(primaryTrip.id) : [];
  const canManageInfo = canManagePrograms && canManageTrips;
  // Plafond de réduction : chargé et transmis pour l'administrateur seulement.
  const canAdminDiscount = await hasPermission(session, "remises.admin");
  const discountCap = canAdminDiscount && primaryTrip ? await getTripDiscountCap(primaryTrip.id) : null;

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
        tripHotelIds={tripHotels.map((h) => h.hotel_id)}
        roomsCount={rooms.length}
        tiers={tiers}
        faqs={faqs}
        canManagePrograms={canManagePrograms}
        canManageTrips={canManageTrips}
        canManageInfo={canManageInfo}
        showCharges={showCharges}
        canManageCharges={canManageCharges}
        expenses={expenses}
        canAdminDiscount={canAdminDiscount}
        discountCap={discountCap}
      />
    </div>
  );
}
