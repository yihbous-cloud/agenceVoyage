import { notFound } from "next/navigation";
import Link from "next/link";
import { getRegistrationById } from "@/lib/registrations";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTripHotels } from "@/lib/roomAssignment";
import { listGroupsForTrip } from "@/lib/registrationGroups";
import { listHotelPreferencesForRegistration } from "@/lib/registrationHotelPreferences";
import { listRoomAssignmentsForRegistration } from "@/lib/registrationRoomAssignments";
import { listPaymentsForRegistration } from "@/lib/payments";
import { getFlightBookingForRegistration } from "@/lib/flightBookings";
import { listTiersForTrip } from "@/lib/tripHotelTiers";
import { listPhoneNumbersForTraveler } from "@/lib/travelerPhoneNumbers";
import InscriptionManagerGrid from "./InscriptionManagerGrid";
import Icon from "../../_components/Icon";
import { REGISTRATION_STATUS, VISA_STATUS, initialsOf } from "../../_components/statusStyles";

export default async function RegistrationDetailPage({ params, searchParams }) {
  const { id } = await params;
  const search = await searchParams;
  // "Afficher" (liste) → lecture seule par défaut si déjà rempli/confirmé ;
  // "Modifier" (?mode=edit) → tout déverrouillé dès l'ouverture — voir
  // CLAUDE.md. Aucun autre effet que l'état initial de verrouillage des
  // sections concernées (voyageur, hébergement) : le reste du formulaire
  // suit toujours les permissions par rôle comme avant.
  const mode = search?.mode === "edit" ? "edit" : "view";
  const registration = await getRegistrationById(id);
  const session = await getSession();

  if (!registration) {
    notFound();
  }

  const [
    rooms,
    tripHotels,
    tripGroups,
    payments,
    flightBooking,
    hotelPreferences,
    tiers,
    phoneNumbers,
    canEditVoyageur,
    canManagePayments,
    canDeleteRegistration,
  ] = await Promise.all([
    listRoomAssignmentsForRegistration(registration.id),
    listTripHotels(registration.trip_id),
    listGroupsForTrip(registration.trip_id),
    listPaymentsForRegistration(id),
    getFlightBookingForRegistration(id),
    listHotelPreferencesForRegistration(id),
    registration.program_family === "omra_hajj" ? listTiersForTrip(registration.trip_id) : [],
    listPhoneNumbersForTraveler(registration.traveler_id),
    hasPermission(session, "inscriptions.edit_voyageur"),
    hasPermission(session, "paiements.manage"),
    hasPermission(session, "inscriptions.delete"),
  ]);

  // canEditVisa/canEditFinance : restrictions fines par champ sur le rôle
  // brut, pas le système de permissions dynamique (même exception assumée
  // que canEditStatus, voir CLAUDE.md §3undecies) — déplacées ici depuis
  // EditRegistrationForm.jsx pour piloter VisaStatusForm/GroupDueForm.
  const canEditFinance = ["direction", "comptabilite"].includes(session?.role);
  const canEditVisa = ["direction", "suivi"].includes(session?.role);
  const apiBasePath = `/api/admin/registrations/${registration.id}`;

  const status = REGISTRATION_STATUS[registration.status];
  const visa = VISA_STATUS[registration.visa_status];
  const departure = new Date(registration.departure_date).toLocaleDateString("fr-FR");
  const backHref = registration.trip_id ? `/admin/inscriptions?tripId=${registration.trip_id}` : "/admin/inscriptions";

  const infoCells = [
    {
      icon: "bed",
      label: "Chambre",
      value:
        rooms.length > 0
          ? rooms.map((r) => (
              <div key={r.city}>
                <span translate="no">{r.city}</span> · <span translate="no">{r.hotel_name}</span>
                <span style={{ color: "var(--gf-subtle)", fontWeight: 400 }}>
                  {" "}
                  — {r.room_type} {r.room_number || ""}
                </span>
              </div>
            ))
          : "Non affectée",
    },
    {
      icon: "hotel_class",
      label: "Préférence hébergement",
      value:
        hotelPreferences.length > 0 || registration.preferred_room_type ? (
          <>
            {hotelPreferences.map((p) => (
              <div key={p.city}>
                <span translate="no">{p.city}</span> → <span translate="no">{p.hotel_name}</span>
              </div>
            ))}
            {registration.preferred_room_type && <div>Chambre {registration.preferred_room_type}</div>}
          </>
        ) : (
          "Aucune"
        ),
    },
    {
      icon: "groups",
      label: "Groupe / binôme",
      value: registration.group_label ? (
        <>
          <Link href={`/admin/groupes/${registration.group_id}`} translate="no">
            {registration.group_label}
          </Link>
          {Boolean(registration.allow_mixed_gender_room) && (
            <span className="ms-1 text-xs font-normal text-emerald-700">(couple/famille)</span>
          )}
        </>
      ) : (
        "Voyageur seul"
      ),
    },
    {
      icon: "airplane_ticket",
      label: "Billet d'avion",
      value: flightBooking ? (
        <>
          <span className="gf-mono" translate="no">{flightBooking.booking_reference || "Réservé"}</span>
          {flightBooking.ticket_number && ` (billet ${flightBooking.ticket_number})`}
          {flightBooking.duffel_mode === "test" && <span className="ms-1 text-xs text-blue-600">[test]</span>}
        </>
      ) : (
        "Non réservé"
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="gf-page-head">
        <div className="gf-page-head-main">
          <span className="gf-avatar-lg" translate="no">
            {initialsOf(registration.full_name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 translate="no">{registration.full_name}</h1>
              {status && (
                <span className="gf-pill" style={{ background: status.bg, color: status.fg }}>
                  {status.label}
                </span>
              )}
            </div>
            {registration.full_name_arabic && (
              <p dir="rtl" translate="no" style={{ marginTop: 2, fontSize: 14, color: "var(--gf-muted)" }}>
                {registration.full_name_arabic}
              </p>
            )}
            <p className="gf-page-desc flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Icon name="travel_explore" size={16} />
                <span translate="no">{registration.program_title}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="event" size={16} />
                {departure}
              </span>
              {visa && (
                <span className="inline-flex items-center gap-1">
                  <Icon name={visa.icon} size={16} fill style={{ color: visa.color }} />
                  {`Visa : ${visa.label}`}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="gf-page-actions">
          <Link href={backHref} className="gf-btn-outline" style={{ height: 38 }}>
            <Icon name="arrow_back" size={16} className="gf-tile-arrow" />
            Retour à la liste
          </Link>
        </div>
      </div>

      <div className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <div className="gf-card-title">
            <Icon name="list_alt" />
            Récapitulatif
          </div>
          <span style={{ fontSize: 12.5, color: "var(--gf-subtle)" }} translate="no">
            {registration.reference_code}
          </span>
        </div>
        <div className="gf-info-grid" style={{ marginTop: 1 }}>
          {infoCells.map((cell) => (
            <div key={cell.label} className="gf-info-cell">
              <span className="gf-kpi-icon">
                <Icon name={cell.icon} size={17} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="gf-info-label">{cell.label}</div>
                <div className="gf-info-value">{cell.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 600 }}>
        <Icon name="assignment" size={19} style={{ color: "var(--gf-subtle)" }} />
        Dossier du voyageur
      </div>

      <InscriptionManagerGrid
        registration={registration}
        role={session?.role}
        canDelete={canDeleteRegistration}
        tripGroups={tripGroups}
        tiers={tiers}
        initialMode={mode}
        initialPhoneNumbers={phoneNumbers}
        payments={payments}
        apiBasePath={apiBasePath}
        canEditVoyageur={canEditVoyageur}
        canManagePayments={canManagePayments}
        canEditFinance={canEditFinance}
        canEditVisa={canEditVisa}
      />
    </div>
  );
}
