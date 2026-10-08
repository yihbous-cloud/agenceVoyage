import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { repriceRegistration } from "./registrationPricing";
import { syncGroupPaymentStatus } from "./paymentStatus";

// Un groupe lie plusieurs inscriptions du même voyage (binôme/couple,
// famille, groupe d'amis) — voir CLAUDE.md pour la règle de mixité associée.

export async function listGroupsForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT rg.*, COUNT(r.id) AS member_count
     FROM registration_groups rg
     LEFT JOIN registrations r ON r.group_id = rg.id AND r.status != 'annule'
     WHERE rg.trip_id = ? AND rg.agency_id = ?
     GROUP BY rg.id
     ORDER BY rg.label ASC`,
    [tripId, agencyId]
  );
}

export async function createGroup(tripId, label, allowMixedGenderRoom) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  const result = await query(
    `INSERT INTO registration_groups (trip_id, label, allow_mixed_gender_room, agency_id)
     VALUES (?, ?, ?, ?)`,
    [tripId, label, Boolean(allowMixedGenderRoom), agencyId]
  );
  return result.insertId;
}

export async function getGroupById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT rg.*, t.reference_code, t.departure_date, t.return_date,
            p.id AS program_id, p.title AS program_title, p.family AS program_family,
            resp_tr.full_name AS responsible_full_name
     FROM registration_groups rg
     JOIN trips t ON t.id = rg.trip_id
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registrations resp_reg ON resp_reg.id = rg.responsible_registration_id
     LEFT JOIN travelers resp_tr ON resp_tr.id = resp_reg.traveler_id
     WHERE rg.id = ? AND rg.agency_id = ?
     LIMIT 1`,
    [id, agencyId]
  );
  return rows[0] || null;
}

// Choix explicite du personnel depuis la page du groupe (menu déroulant
// parmi les membres actuels) — voir CLAUDE.md.
export async function updateGroupResponsible(groupId, responsibleRegistrationId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("registration_groups", groupId, agencyId);
  if (responsibleRegistrationId) {
    await assertOwned("registrations", responsibleRegistrationId, agencyId);
  }
  await query(
    `UPDATE registration_groups SET responsible_registration_id = ? WHERE id = ? AND agency_id = ?`,
    [responsibleRegistrationId || null, groupId, agencyId]
  );
  return getGroupById(groupId);
}

// Garantit qu'un groupe a toujours un responsable valide (le voyageur
// point de contact) — sans champ à remplir à la création : le premier
// membre inséré le devient automatiquement. Idempotent et sans effet si le
// responsable actuel est toujours membre du groupe ; sinon retombe sur le
// membre restant le plus ancien (id le plus bas), ou NULL si le groupe est
// vide. À appeler après tout événement qui change la composition d'un
// groupe (nouveau membre, membre qui part, suppression) — voir
// lib/registrations.js.
export async function ensureGroupResponsible(groupId) {
  if (!groupId) return;
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT rg.responsible_registration_id,
            EXISTS(
              SELECT 1 FROM registrations
              WHERE id = rg.responsible_registration_id AND group_id = rg.id
            ) AS still_member,
            (SELECT id FROM registrations WHERE group_id = rg.id ORDER BY id ASC LIMIT 1) AS fallback_id
     FROM registration_groups rg
     WHERE rg.id = ? AND rg.agency_id = ?`,
    [groupId, agencyId]
  );
  const group = rows[0];
  if (!group) return;
  if (group.responsible_registration_id && group.still_member) return;
  await query(
    `UPDATE registration_groups SET responsible_registration_id = ? WHERE id = ? AND agency_id = ?`,
    [group.fallback_id, groupId, agencyId]
  );
}

// Étendu (§3cinquantehuitquadragies) pour porter tout ce dont
// EditRegistrationForm.jsx a besoin par membre — la page du groupe rend
// désormais ce formulaire une fois par membre, plus une simple liste en
// lecture seule. `id` (pas `registration_id`) pour matcher directement la
// forme attendue par ce composant (registration.id partout).
// Étendu (§3soixantehuitquadragies) pour porter aussi ce dont
// EditTravelerForm.jsx a besoin par membre — carte "Informations
// Voyageurs" désormais accessible depuis la page du groupe elle-même.
export async function getGroupMembers(groupId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT r.id, r.status, r.visa_status, r.total_due, r.notes,
            r.preferred_room_type, r.selected_tier_id, r.group_id, r.trip_id,
            r.package_type, r.base_price, r.discount_type, r.discount_value, r.discount_amount,
            r.discount_reason, r.discount_note,
            t.price_double, t.price_triple, t.price_quadruple, t.price_quintuple, t.price_flight_only,
            r.traveler_id, tr.full_name, tr.full_name_arabic, tr.gender,
            tr.date_of_birth, tr.national_id, tr.phone, tr.phone_whatsapp,
            tr.passport_number, tr.passport_issue_date, tr.passport_expiry_date,
            tr.email AS traveler_email, tr.address
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     WHERE r.group_id = ? AND r.agency_id = ?
     ORDER BY tr.full_name ASC`,
    [groupId, agencyId]
  );
}

// Le suivi financier (montant dû) d'un groupe est partagé par tous ses
// membres — voir migration 012 et CLAUDE.md.
export async function updateGroupTotalDue(id, totalDue) {
  const agencyId = await resolveAgencyId();
  await assertOwned("registration_groups", id, agencyId);
  await query(`UPDATE registration_groups SET total_due = ? WHERE id = ? AND agency_id = ?`, [
    totalDue,
    id,
    agencyId,
  ]);
  await syncGroupPaymentStatus(id);
  return getGroupById(id);
}

// Recalcule automatiquement registration_groups.total_due comme la somme
// du prix de CHAQUE membre actif, selon SON tarif d'hébergement choisi
// (trip_hotel_tier_prices, prioritaire) ou, à défaut, le prix plat du
// voyage selon son type de chambre souhaité (pickTripPrice) — même règle
// que le pré-remplissage à l'inscription (§3septendecies), mais rejouée à
// chaque changement de composition/tarif du groupe plutôt qu'une seule fois
// à la création. Décision explicite de l'utilisateur : ce recalcul est
// automatique et SILENCIEUX (écrase un montant déjà négocié) — appelée
// depuis lib/registrations.js à chaque création/modification/suppression
// d'une inscription qui touche l'appartenance au groupe, le statut, le
// tarif ou le type de chambre d'un membre.
export async function recalculateGroupTotalDue(groupId) {
  const agencyId = await resolveAgencyId();
  const members = await query(
    `SELECT id FROM registrations WHERE group_id = ? AND status != 'annule' AND agency_id = ?`,
    [groupId, agencyId]
  );
  // Montant net de chaque membre (formule − réduction, lib/registrationPricing.js) :
  // une réduction accordée à un membre n'est jamais écrasée par le recalcul.
  let total = 0;
  for (const m of members) total += Number(await repriceRegistration(m.id));
  total = Math.round(total * 100) / 100;

  await query(`UPDATE registration_groups SET total_due = ? WHERE id = ? AND agency_id = ?`, [
    total,
    groupId,
    agencyId,
  ]);
  await syncGroupPaymentStatus(groupId);
  return total;
}
