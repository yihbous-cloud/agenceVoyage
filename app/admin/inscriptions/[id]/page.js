import { notFound } from "next/navigation";
import { getRegistrationById } from "@/lib/registrations";
import { getSession } from "@/lib/session";
import { listVisaTypesForProgram, getVisaRequestByRegistration } from "@/lib/visaTypes";
import { listServices, listRegistrationServices } from "@/lib/services";
import { getRoomDetails } from "@/lib/roomAssignment";
import { listPaymentsForRegistration } from "@/lib/payments";
import { getFlightBookingForRegistration } from "@/lib/flightBookings";
import EditRegistrationForm from "./EditRegistrationForm";
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

  const [visaTypes, visaRequest, catalogServices, registrationServices, room, payments, flightBooking] =
    await Promise.all([
      listVisaTypesForProgram(registration.program_id),
      getVisaRequestByRegistration(id),
      listServices(),
      listRegistrationServices(id),
      registration.room_id ? getRoomDetails(registration.room_id) : null,
      listPaymentsForRegistration(id),
      getFlightBookingForRegistration(id),
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
            <dt className="text-zinc-500">WhatsApp</dt>
            <dd className="font-medium text-zinc-900">{registration.phone_whatsapp}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Passeport</dt>
            <dd className="font-medium text-zinc-900">
              {registration.passport_number || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Genre</dt>
            <dd className="font-medium capitalize text-zinc-900">
              {registration.gender}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">
              {registration.traveler_email || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chambre</dt>
            <dd className="font-medium text-zinc-900">
              {room
                ? `${room.hotel_name} — ${room.room_type} ${room.room_number || ""}`
                : "Non affectée"}
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

      <EditRegistrationForm registration={registration} role={session?.role} />

      <VisaSection
        registrationId={registration.id}
        visaTypes={visaTypes}
        visaRequest={visaRequest}
        role={session?.role}
      />

      <ServicesSection
        registrationId={registration.id}
        catalogServices={catalogServices}
        registrationServices={registrationServices}
        flightTicketPrice={registration.flight_ticket_price}
        role={session?.role}
      />

      <PaymentsSection
        registrationId={registration.id}
        payments={payments}
        totalDue={registration.total_due}
        role={session?.role}
      />
    </div>
  );
}
