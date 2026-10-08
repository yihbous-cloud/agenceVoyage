import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";

// Une chambre par ville (Mecque + Médine, voir CLAUDE.md) — remplace
// registrations.room_id (colonne scalaire unique, dépréciée). Les écritures
// (affectation/désaffectation) vivent dans lib/roomAssignment.js, qui a
// besoin de la connexion/transaction partagée pour les contrôles de
// capacité/mixité — ce fichier ne fait que du CRUD en lecture, même
// séparation que lib/registrationHotelPreferences.js.

export async function listRoomAssignmentsForRegistration(registrationId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT rra.city, rm.room_number, rm.room_type, ${hotelNameSql("h", locale)} AS hotel_name
     FROM registration_room_assignments rra
     JOIN rooms rm ON rm.id = rra.room_id
     JOIN trip_hotels th ON th.id = rm.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     WHERE rra.registration_id = ? AND rra.agency_id = ?
     ORDER BY rra.city ASC`,
    [registrationId, agencyId]
  );
}

// Toutes les affectations de tous les voyageurs d'un voyage, en un seul
// aller-retour — évite le N+1 dans listUnassignedRegistrations
// (lib/roomAssignment.js).
export async function listRoomAssignmentsForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT rra.registration_id, rra.city, rra.room_id
     FROM registration_room_assignments rra
     JOIN registrations r ON r.id = rra.registration_id
     WHERE r.trip_id = ? AND r.agency_id = ? AND rra.agency_id = ?`,
    [tripId, agencyId, agencyId]
  );
}
