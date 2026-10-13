import { notFound } from "next/navigation";
import { getProgramById, listTripsForProgram, listAllPrograms } from "@/lib/programsAdmin";
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
import { listTranslations, toFormValues } from "@/lib/contentTranslations";
import { listProgramMedia } from "@/lib/programMedia";
import { listReviewsForProgram } from "@/lib/programReviews";
import { programCompleteness } from "@/lib/programCompleteness";
import { PRICE_TIER_FIELD } from "@/lib/roomTypes";

export default async function ProgramDetailPage({ params }) {
  const { id } = await params;

  const [program, trips, faqs, defaultHotels, hotels, airlines, session, allPrograms] = await Promise.all([
    getProgramById(id),
    listTripsForProgram(id),
    listAllFaqsForProgram(id),
    listDefaultHotelsForProgram(id),
    listHotels(),
    listAirlines(),
    getSession(),
    listAllPrograms(),
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

  // Autre langue du programme et de ses FAQ (vague 1B du référencement).
  const [programTranslations, faqTranslations, media, reviews] = await Promise.all([
    listTranslations("program", [program.id]),
    listTranslations("faq", faqs.map((f) => f.id)),
    listProgramMedia(program.id),
    listReviewsForProgram(program.id),
  ]);

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

  // Complétude de la fiche publique (10 blocs du cahier référencement,
  // vague 2A) — calculée sur le voyage principal, comme les autres cartes.
  const tripPrices = primaryTrip
    ? [
        ...Object.values(PRICE_TIER_FIELD).map((column) => Number(primaryTrip[column])),
        ...tiers.flatMap((t) => (t.prices || []).map((p) => Number(p.price_per_person))),
      ].filter((n) => n > 0)
    : [];
  const completeness = programCompleteness({
    program,
    nextTrip: primaryTrip
      ? {
          departure_date: primaryTrip.departure_date,
          return_date: primaryTrip.return_date,
          price: tripPrices.length > 0 ? Math.min(...tripPrices) : 0,
          airline: primaryTrip.airline_id,
          baggage_allowance: primaryTrip.baggage_allowance,
          hotelCount: tripHotels.length,
        }
      : null,
    faqCount: faqs.filter((f) => f.is_published).length,
    photoCount: media.filter((m) => m.kind === "photo").length,
    videoCount: media.filter((m) => m.kind === "video").length,
    reviewCount: reviews.filter((r) => r.is_published && r.consent_given).length,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{program.title}</h1>

      <ProgramManagerGrid
        programId={id}
        program={program}
        successorOptions={allPrograms
          .filter((p) => p.id !== Number(id))
          .map((p) => ({ id: p.id, title: p.title, is_published: p.is_published }))}
        primaryTrip={primaryTrip}
        airlines={airlines}
        hotels={hotels}
        defaultHotelIds={defaultHotels.map((h) => h.id)}
        tripHotelsCount={tripHotels.length}
        tripHotelIds={tripHotels.map((h) => h.hotel_id)}
        roomsCount={rooms.length}
        tiers={tiers}
        faqs={faqs}
        programTranslations={toFormValues("program", programTranslations[program.id])}
        faqTranslations={Object.fromEntries(
          Object.entries(faqTranslations).map(([faqId, byLocale]) => [faqId, toFormValues("faq", byLocale)])
        )}
        canManagePrograms={canManagePrograms}
        canManageTrips={canManageTrips}
        canManageInfo={canManageInfo}
        showCharges={showCharges}
        canManageCharges={canManageCharges}
        expenses={expenses}
        canAdminDiscount={canAdminDiscount}
        discountCap={discountCap}
        media={media}
        reviews={reviews}
        trips={trips.map((t) => ({ id: t.id, reference_code: t.reference_code }))}
        completeness={completeness}
      />
    </div>
  );
}
