import { getPool } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { isPassportExpiryValid } from "./passportValidation";

// Transfère totalement une inscription (ou tout son groupe/binôme) vers un
// autre voyage — éventuellement d'un autre programme. Un membre de groupe
// n'est jamais déplacé seul : un groupe n'a de sens que sur UN voyage
// (registration_groups.trip_id), c'est donc toujours le groupe entier qui
// bouge, avec ses versements (payments.group_id suit le groupe).
//
// Ce qui est remis à zéro, car propre à l'ancien voyage : affectations de
// chambre, préférences d'hôtel par ville, et tarif d'hébergement choisi
// (un tarif appartient à un voyage précis). Le montant dû et les versements
// sont conservés tels quels — aucun recalcul silencieux d'un montant déjà
// encaissé ; le personnel choisit le nouveau tarif et ajuste le montant si
// besoin depuis la fiche.
export async function transferRegistrationToTrip(registrationId, targetTripId) {
  const agencyId = await resolveAgencyId();
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[registration]] = await connection.execute(
      `SELECT id, trip_id, group_id FROM registrations WHERE id = ? AND agency_id = ? FOR UPDATE`,
      [registrationId, agencyId]
    );
    if (!registration) throw new Error("Inscription introuvable");

    if (Number(registration.trip_id) === Number(targetTripId)) {
      throw new Error("Le voyageur est déjà inscrit à ce voyage");
    }

    const [[target]] = await connection.execute(
      `SELECT id, departure_date, total_seats, status FROM trips WHERE id = ? AND agency_id = ? FOR UPDATE`,
      [targetTripId, agencyId]
    );
    if (!target) throw new Error("Voyage de destination introuvable");
    if (!["ouvert", "planifie"].includes(target.status)) {
      throw new Error("Ce voyage n'accepte plus de nouveaux inscrits");
    }

    const [members] = registration.group_id
      ? await connection.execute(
          `SELECT r.id, r.traveler_id, r.status, tr.full_name, tr.passport_expiry_date
           FROM registrations r JOIN travelers tr ON tr.id = r.traveler_id
           WHERE r.group_id = ? AND r.trip_id = ? AND r.agency_id = ? FOR UPDATE`,
          [registration.group_id, registration.trip_id, agencyId]
        )
      : await connection.execute(
          `SELECT r.id, r.traveler_id, r.status, tr.full_name, tr.passport_expiry_date
           FROM registrations r JOIN travelers tr ON tr.id = r.traveler_id
           WHERE r.id = ? AND r.agency_id = ? FOR UPDATE`,
          [registration.id, agencyId]
        );

    const memberIds = members.map((m) => m.id);
    const placeholders = memberIds.map(() => "?").join(", ");

    const [[{ bookedCount }]] = await connection.execute(
      `SELECT COUNT(*) AS bookedCount FROM flight_booking_passengers WHERE agency_id = ? AND registration_id IN (${placeholders})`,
      [agencyId, ...memberIds]
    );
    if (bookedCount > 0) {
      throw new Error(
        "Transfert impossible : au moins un voyageur est déjà inclus dans une commande de billets d'avion de l'ancien voyage"
      );
    }

    const active = members.filter((m) => m.status !== "annule");

    // Même règle que partout ailleurs (§3nonies) : passeport valide 6 mois
    // après le départ du NOUVEAU voyage.
    for (const m of active) {
      if (!isPassportExpiryValid(m.passport_expiry_date, target.departure_date)) {
        throw new Error(
          `${m.full_name} : le passeport expire trop tôt pour ce voyage (validité requise : 6 mois après le départ)`
        );
      }
    }

    const [alreadyThere] = await connection.execute(
      `SELECT tr.full_name FROM registrations r JOIN travelers tr ON tr.id = r.traveler_id
       WHERE r.trip_id = ? AND r.agency_id = ? AND r.traveler_id IN (${placeholders})`,
      [targetTripId, agencyId, ...members.map((m) => m.traveler_id)]
    );
    if (alreadyThere.length > 0) {
      throw new Error(
        `${alreadyThere.map((r) => r.full_name).join(", ")} : déjà inscrit(e) au voyage de destination`
      );
    }

    if (target.total_seats > 0) {
      const [[{ taken }]] = await connection.execute(
        `SELECT COUNT(*) AS taken FROM registrations WHERE trip_id = ? AND agency_id = ? AND status != 'annule'`,
        [targetTripId, agencyId]
      );
      if (taken + active.length > target.total_seats) {
        throw new Error("Pas assez de places disponibles sur le voyage de destination");
      }
    }

    await connection.execute(
      `DELETE FROM registration_room_assignments WHERE agency_id = ? AND registration_id IN (${placeholders})`,
      [agencyId, ...memberIds]
    );
    await connection.execute(
      `DELETE FROM registration_hotel_preferences WHERE agency_id = ? AND registration_id IN (${placeholders})`,
      [agencyId, ...memberIds]
    );
    await connection.execute(
      `UPDATE registrations SET trip_id = ?, selected_tier_id = NULL, room_id = NULL
       WHERE agency_id = ? AND id IN (${placeholders})`,
      [targetTripId, agencyId, ...memberIds]
    );
    if (registration.group_id) {
      await connection.execute(
        `UPDATE registration_groups SET trip_id = ? WHERE id = ? AND agency_id = ?`,
        [targetTripId, registration.group_id, agencyId]
      );
    }

    await connection.commit();
    return { movedCount: members.length, wasGroup: Boolean(registration.group_id) };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
