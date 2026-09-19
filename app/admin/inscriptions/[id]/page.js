import { notFound } from "next/navigation";
import Link from "next/link";
import { getRegistrationById } from "@/lib/registrations";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getRoomDetails, listTripHotels } from "@/lib/roomAssignment";
import { listGroupsForTrip } from "@/lib/registrationGroups";
import { listHotelPreferencesForRegistration } from "@/lib/registrationHotelPreferences";
import { listPaymentsForRegistration } from "@/lib/payments";
import { getFlightBookingForRegistration } from "@/lib/flightBookings";
import EditRegistrationForm from "./EditRegistrationForm";
import EditTravelerForm from "./EditTravelerForm";
import PaymentsSection from "./PaymentsSection";

export default async function RegistrationDetailPage({ params }) {
  const { id } = await params;
  const registration = await getRegistrationById(id);
  const session = await getSession();

  if (!registration) {
    notFound();
  }

  const [
    room,
    tripHotels,
    tripGroups,
    payments,
    flightBooking,
    hotelPreferences,
    canEditVoyageur,
    canManagePayments,
    canDeleteRegistration,
  ] = await Promise.all([
    registration.room_id ? getRoomDetails(registration.room_id) : null,
    listTripHotels(registration.trip_id),
    listGroupsForTrip(registration.trip_id),
    listPaymentsForRegistration(id),
    getFlightBookingForRegistration(id),
    listHotelPreferencesForRegistration(id),
    hasPermission(session, "inscriptions.edit_voyageur"),
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
              {hotelPreferences.length > 0 || registration.preferred_room_type ? (
                <>
                  {hotelPreferences.map((p) => (
                    <div key={p.city}>
                      {p.city} → {p.hotel_name}
                    </div>
                  ))}
                  {registration.preferred_room_type && (
                    <div>Type : {registration.preferred_room_type}</div>
                  )}
                </>
              ) : (
                "Aucune"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Groupe / binôme</dt>
            <dd className="font-medium text-zinc-900">
              {registration.group_label ? (
                <>
                  {registration.group_label}
                  {Boolean(registration.allow_mixed_gender_room) && (
                    <span className="ml-1 text-xs font-normal text-emerald-700">
                      (couple/famille)
                    </span>
                  )}
                  {" — "}
                  <Link
                    href={`/admin/groupes/${registration.group_id}`}
                    className="text-xs font-normal text-emerald-700 hover:underline"
                  >
                    Voir le groupe
                  </Link>
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
        hotelPreferences={hotelPreferences}
        tripGroups={tripGroups}
      />

      {registration.group_id ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Paiements</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Ce voyageur fait partie du groupe <strong>{registration.group_label}</strong> :
            le suivi financier (montant dû, versements, reçus) se fait au niveau du
            groupe, pas individuellement.
          </p>
          <Link
            href={`/admin/groupes/${registration.group_id}`}
            className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Gérer le paiement du groupe →
          </Link>
        </div>
      ) : (
        <PaymentsSection
          apiBasePath={`/api/admin/registrations/${registration.id}`}
          payments={payments}
          totalDue={registration.total_due}
          canManage={canManagePayments}
        />
      )}
    </div>
  );
}
