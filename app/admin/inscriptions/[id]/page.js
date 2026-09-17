import { notFound } from "next/navigation";
import { getRegistrationById } from "@/lib/registrations";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listVisaTypesForProgram, getVisaRequestByRegistration } from "@/lib/visaTypes";
import { listServices, listRegistrationServices } from "@/lib/services";
import { getRoomDetails, listTripHotels } from "@/lib/roomAssignment";
import { listGroupsForTrip } from "@/lib/registrationGroups";
import { listPaymentsForRegistration } from "@/lib/payments";
import { getFlightBookingForRegistration } from "@/lib/flightBookings";
import EditRegistrationForm from "./EditRegistrationForm";
import EditTravelerForm from "./EditTravelerForm";
import VisaSection from "./VisaSection";
import ServicesSection from "./ServicesSection";
import PaymentsSection from "./PaymentsSection";

export default async function RegistrationDetailPage({ params }) {
  const { id } = await params;
  const registration = await getRegistrationById(id);
  const session = await getSession();

  if (!registration) {
    notFound();
  }

  const [
    visaTypes,
    visaRequest,
    catalogServices,
    registrationServices,
    room,
    tripHotels,
    tripGroups,
    payments,
    flightBooking,
    canEditVoyageur,
    canManageVisa,
    canManageServices,
    canManagePayments,
    canDeleteRegistration,
  ] = await Promise.all([
    listVisaTypesForProgram(registration.program_id),
    getVisaRequestByRegistration(id),
    listServices(),
    listRegistrationServices(id),
    registration.room_id ? getRoomDetails(registration.room_id) : null,
    listTripHotels(registration.trip_id),
    listGroupsForTrip(registration.trip_id),
    listPaymentsForRegistration(id),
    getFlightBookingForRegistration(id),
    hasPermission(session, "inscriptions.edit_voyageur"),
    hasPermission(session, "inscriptions.visa"),
    hasPermission(session, "inscriptions.services"),
    hasPermission(session, "paiements.manage"),
    hasPermission(session, "inscriptions.delete"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{registration.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {registration.program_title} — {registration.reference_code} (
          {new Date(registration.departure_date).toLocaleDateString("fr-FR")})
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Chambre</dt>
            <dd className="font-medium text-zinc-900">
              {room
                ? `${room.hotel_name} — ${room.room_type} ${room.room_number || ""}`
                : "Non affectée"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Préférence hébergement</dt>
            <dd className="font-medium text-zinc-900">
              {registration.preferred_hotel_name || registration.preferred_room_type
                ? `${registration.preferred_hotel_name || "—"}${
                    registration.preferred_room_type
                      ? ` — ${registration.preferred_room_type}`
                      : ""
                  }`
                : "Aucune"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Groupe / binôme</dt>
            <dd className="font-medium text-zinc-900">
              {registration.group_label ? (
                <>
                  {registration.group_label}
                  {registration.allow_mixed_gender_room && (
                    <span className="ml-1 text-xs font-normal text-emerald-700">
                      (couple/famille)
                    </span>
                  )}
                </>
              ) : (
                "Voyageur seul"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Billet d&apos;avion</dt>
            <dd className="font-medium text-zinc-900">
              {flightBooking ? (
                <>
                  {flightBooking.booking_reference || "Réservé"}
                  {flightBooking.ticket_number && ` (billet ${flightBooking.ticket_number})`}
                  {flightBooking.duffel_mode === "test" && (
                    <span className="ml-1 text-xs text-blue-600">[test]</span>
                  )}
                </>
              ) : (
                "Non réservé"
              )}
            </dd>
          </div>
        </dl>
      </div>

      <EditTravelerForm registration={registration} canEdit={canEditVoyageur} />

      <EditRegistrationForm
        registration={registration}
        role={session?.role}
        canDelete={canDeleteRegistration}
        tripHotels={tripHotels}
        tripGroups={tripGroups}
      />

      <VisaSection
        registrationId={registration.id}
        visaTypes={visaTypes}
        visaRequest={visaRequest}
        canManage={canManageVisa}
      />

      <ServicesSection
        registrationId={registration.id}
        catalogServices={catalogServices}
        registrationServices={registrationServices}
        flightTicketPrice={registration.flight_ticket_price}
        canManage={canManageServices}
      />

      <PaymentsSection
        registrationId={registration.id}
        payments={payments}
        totalDue={registration.total_due}
        canManage={canManagePayments}
      />
    </div>
  );
}
