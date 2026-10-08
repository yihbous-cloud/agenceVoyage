import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { adminHotelLocale, hotelNameSql } from "./hotelNames";
import { listHotelPreferencesForTrip } from "./registrationHotelPreferences";
import { listRoomAssignmentsForTrip } from "./registrationRoomAssignments";
import { listTiersForTrip } from "./tripHotelTiers";
import { emitCrmEvent } from "./events";

// Une inscription avec un tarif d'hébergement (trip_hotel_tiers, Omra/Hajj
// uniquement — §3unquadragies) a déjà choisi ses hôtels via CE TARIF
// (makkah_hotel_id/madinah_hotel_id) — depuis que le formulaire
// d'inscription a retiré les champs "Hôtel souhaité" séparés une fois un
// tarif sélectionné (§3unquadragies), le tarif EST la préférence d'hôtel
// par ville, prioritaire sur registration_hotel_preferences (qui reste le
// mécanisme pour une inscription sans tarif — voyage sans tiers configurés,
// ou inscription antérieure à l'introduction des tarifs). Sans ce mapping,
// la répartition automatique et l'alerte de préférence non respectée
// ignoraient complètement le choix fait via le tarif — voir CLAUDE.md.
function effectiveHotelPreferences(registration, explicitPreferences, tiersById) {
  const tier = registration.selected_tier_id ? tiersById.get(registration.selected_tier_id) : null;
  if (!tier) return explicitPreferences;
  const fromTier = [];
  if (tier.makkah_hotel_id) {
    fromTier.push({
      city: tier.makkah_hotel_city,
      hotel_id: tier.makkah_hotel_id,
      hotel_name: tier.makkah_hotel_name,
    });
  }
  if (tier.madinah_hotel_id) {
    fromTier.push({
      city: tier.madinah_hotel_city,
      hotel_id: tier.madinah_hotel_id,
      hotel_name: tier.madinah_hotel_name,
    });
  }
  return fromTier;
}

export async function getTripSummary(tripId) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT t.id, t.program_id, t.reference_code, t.departure_date, t.return_date,
            t.origin_iata, t.destination_iata,
            p.title AS program_title, p.family AS program_family, p.slug AS program_slug
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.id = ? AND t.agency_id = ?
     LIMIT 1`,
    [tripId, agencyId]
  );
  return rows[0] || null;
}

// --- Hôtels associés à un voyage ---

export async function listTripHotels(tripId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT th.*, ${hotelNameSql("h", locale)} AS hotel_name, h.city, h.star_rating
     FROM trip_hotels th
     JOIN hotels h ON h.id = th.hotel_id
     WHERE th.trip_id = ? AND th.agency_id = ?
     ORDER BY th.check_in_date ASC, h.city ASC`,
    [tripId, agencyId]
  );
}

// Un voyageur ne peut pas être dans deux VILLES en même temps (ex. escale-
// séjour à Istanbul avant l'Arabie Saoudite, voir CLAUDE.md) — détecte un
// hôtel du voyage, dans une AUTRE ville que celle du nouvel hôtel, dont la
// période chevauche celle proposée. Plusieurs hôtels de la MÊME ville
// peuvent en revanche se chevaucher librement (options d'hébergement
// concurrentes pour un même séjour en ville, ex. §3quattuorvicies — chaque
// voyageur choisit ensuite l'une des deux) : exclues du contrôle via le
// JOIN sur `candidate`. Intervalles semi-ouverts : un check-out le même
// jour que le check-in suivant est autorisé (jour de transition normal),
// pas un chevauchement.
export async function findOverlappingTripHotel(tripId, hotelId, checkInDate, checkOutDate) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT th.*, h.name AS hotel_name
     FROM trip_hotels th
     JOIN hotels h ON h.id = th.hotel_id
     JOIN hotels candidate ON candidate.id = ? AND candidate.agency_id = ?
     WHERE th.trip_id = ? AND th.agency_id = ?
       AND h.city != candidate.city
       AND th.check_in_date < ?
       AND ? < th.check_out_date
     LIMIT 1`,
    [hotelId, agencyId, tripId, agencyId, checkOutDate, checkInDate]
  );
  return rows[0] || null;
}

export async function addTripHotel(tripId, hotelId, checkInDate, checkOutDate) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  await assertOwned("hotels", hotelId, agencyId);
  const result = await query(
    `INSERT INTO trip_hotels (trip_id, hotel_id, check_in_date, check_out_date, agency_id)
     VALUES (?, ?, ?, ?, ?)`,
    [tripId, hotelId, checkInDate, checkOutDate, agencyId]
  );
  return result.insertId;
}

// Une chambre déjà affectée (registration_room_assignments.room_id) bloque
// toujours la suppression de son hôtel/voyage (FK RESTRICT implicite,
// intentionnel) — mais registrations.room_id (colonne dépréciée, migration
// 025, plus jamais écrite par le nouveau code) peut encore porter une
// référence OBSOLETE vers une chambre par ailleurs vidée via la nouvelle
// table, et bloquerait alors une suppression légitime avec une erreur SQL
// brute. On la neutralise avant de supprimer — ne lève jamais le contrôle
// réel (celui de registration_room_assignments), seulement le mort.
export async function removeTripHotel(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_hotels", id, agencyId);
  await query(
    `UPDATE registrations SET room_id = NULL
     WHERE agency_id = ? AND room_id IN (SELECT id FROM rooms WHERE trip_hotel_id = ? AND agency_id = ?)`,
    [agencyId, id, agencyId]
  );
  await query(`DELETE FROM trip_hotels WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// --- Chambres ---

export async function listRoomsForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const locale = await adminHotelLocale();
  return query(
    `SELECT r.*, th.hotel_id, ${hotelNameSql("h", locale)} AS hotel_name, h.city AS hotel_city,
            COUNT(reg.id) AS occupants_count,
            GROUP_CONCAT(DISTINCT tr.gender ORDER BY tr.gender SEPARATOR ' + ') AS occupants_gender,
            GROUP_CONCAT(DISTINCT COALESCE(resp_tr.full_name, tr.full_name)
              ORDER BY COALESCE(resp_tr.full_name, tr.full_name) SEPARATOR ' + ') AS occupants_responsible
     FROM rooms r
     JOIN trip_hotels th ON th.id = r.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     LEFT JOIN registration_room_assignments rra ON rra.room_id = r.id
     LEFT JOIN registrations reg ON reg.id = rra.registration_id AND reg.status != 'annule'
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     LEFT JOIN registration_groups rg ON rg.id = reg.group_id
     LEFT JOIN registrations resp_reg ON resp_reg.id = rg.responsible_registration_id
     LEFT JOIN travelers resp_tr ON resp_tr.id = resp_reg.traveler_id
     WHERE th.trip_id = ? AND r.agency_id = ?
     GROUP BY r.id
     ORDER BY h.city ASC, h.name ASC, r.room_number ASC`,
    [tripId, agencyId]
  );
}

export async function createRoom(tripHotelId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_hotels", tripHotelId, agencyId);
  const result = await query(
    `INSERT INTO rooms (trip_hotel_id, room_number, room_type, capacity, agency_id)
     VALUES (?, ?, ?, ?, ?)`,
    [tripHotelId, data.roomNumber || null, data.roomType, data.capacity, agencyId]
  );
  return result.insertId;
}

// Voir removeTripHotel ci-dessus pour la raison de ce nettoyage préalable.
export async function deleteRoom(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("rooms", id, agencyId);
  await query(`UPDATE registrations SET room_id = NULL WHERE room_id = ? AND agency_id = ?`, [
    id,
    agencyId,
  ]);
  await query(`DELETE FROM rooms WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// --- Voyageurs non affectés ---

// N'affiche (et ne propose à l'affectation/répartition auto) que les
// voyageurs ayant au moins un versement enregistré ET une démarche visa au
// moins lancée — inutile de réserver une chambre à quelqu'un qui n'a encore
// ni payé ni entamé son visa, ça peut encore changer. Un acompte partiel et
// un visa "en cours" suffisent (pas besoin d'attendre le paiement complet ni
// l'accord définitif du visa, qui peut prendre du temps) — voir CLAUDE.md.
// Ce filtre reste STRICTEMENT inchangé par le passage au multi-villes.
//
// ⚠️ Pour un membre de groupe, le paiement n'est JAMAIS reflété par
// r.status (qui reste "inscrit" à vie pour un groupe — le suivi financier
// se fait uniquement via registration_groups.total_due / payments.group_id,
// voir §3quindecies) : un membre de groupe déjà payé restait donc caché
// pour toujours. Vérifie à la place l'existence d'un versement du GROUPE.
//
// Depuis §3cinquantecinququadragies : "non affecté" ne signifie plus
// "n'a aucune chambre" mais "n'a pas encore de chambre dans TOUTES les
// villes du voyage" — un voyage multi-villes (Mecque + Médine) a besoin
// d'une chambre par ville (registration_room_assignments), pas d'une seule
// pour tout le séjour. Chaque inscription retournée porte `missingCities`
// (villes encore à affecter) et `assignedCities` (déjà couvertes), utilisés
// par autoAssignTrip et par HebergementManager.jsx pour filtrer les
// chambres candidates aux seules villes encore nécessaires.
export async function listUnassignedRegistrations(tripId) {
  const agencyId = await resolveAgencyId();
  const cityRows = await query(
    `SELECT DISTINCT h.city
     FROM trip_hotels th
     JOIN hotels h ON h.id = th.hotel_id
     WHERE th.trip_id = ? AND th.agency_id = ?`,
    [tripId, agencyId]
  );
  const tripCities = cityRows.map((c) => c.city);

  const registrations = await query(
    `SELECT r.id, r.preferred_room_type, r.selected_tier_id,
            r.group_id, rg.label AS group_label, rg.allow_mixed_gender_room,
            tr.full_name, tr.gender
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     WHERE r.trip_id = ? AND r.agency_id = ?
       AND (
         (r.group_id IS NULL AND r.status IN ('paye_partiel', 'paye_complet'))
         OR (r.group_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM payments p WHERE p.group_id = r.group_id AND p.agency_id = r.agency_id
         ))
       )
       AND r.visa_status IN ('en_cours', 'accorde')
     ORDER BY tr.full_name ASC`,
    [tripId, agencyId]
  );

  // Une préférence d'hôtel par ville (Mecque/Médine — §3quattuorvicies),
  // récupérées en un seul aller-retour et rattachées à chaque voyageur.
  const preferences = await listHotelPreferencesForTrip(tripId);
  const preferencesByRegistration = new Map();
  for (const pref of preferences) {
    if (!preferencesByRegistration.has(pref.registration_id)) {
      preferencesByRegistration.set(pref.registration_id, []);
    }
    preferencesByRegistration.get(pref.registration_id).push(pref);
  }

  // Tarifs d'hébergement du voyage (Omra/Hajj, §3unquadragies) — une
  // inscription avec un tarif choisit son hôtel PAR CE TARIF, voir
  // effectiveHotelPreferences ci-dessus.
  const tiers = await listTiersForTrip(tripId);
  const tiersById = new Map(tiers.map((t) => [t.id, t]));

  // Villes déjà couvertes par une affectation réelle, par inscription.
  const assignments = await listRoomAssignmentsForTrip(tripId);
  const assignedCitiesByRegistration = new Map();
  for (const a of assignments) {
    if (!assignedCitiesByRegistration.has(a.registration_id)) {
      assignedCitiesByRegistration.set(a.registration_id, new Set());
    }
    assignedCitiesByRegistration.get(a.registration_id).add(a.city);
  }

  return registrations
    .map((r) => {
      const assignedCities = [...(assignedCitiesByRegistration.get(r.id) || [])];
      const missingCities = tripCities.filter((c) => !assignedCities.includes(c));
      return {
        ...r,
        hotelPreferences: effectiveHotelPreferences(
          r,
          preferencesByRegistration.get(r.id) || [],
          tiersById
        ),
        assignedCities,
        missingCities,
      };
    })
    // Garde-fou : si le voyage n'a encore AUCUN hôtel attaché (tripCities
    // vide), ne rien filtrer — sinon la liste "non affectés" disparaîtrait
    // avant même qu'un hôtel soit configuré, régression par rapport à
    // avant (où le menu restait simplement vide, non bloquant).
    .filter((r) => tripCities.length === 0 || r.missingCities.length > 0);
}

// --- Voyageurs déjà affectés ---
// Une ligne par (inscription, ville affectée) — un voyageur bi-ville
// (Mecque + Médine) apparaît donc sur deux lignes, chacune avec sa propre
// chambre/préférence. Pour vérifier, une fois la chambre attribuée, qu'elle
// correspond bien à la préférence exprimée à l'inscription (§3quaterdecies)
// — sans ça, un changement manuel de chambre (ou une répartition
// automatique qui ne trouvait plus de chambre compatible) peut placer un
// voyageur dans une chambre différente de ce qu'il avait demandé, sans que
// personne ne le remarque une fois la chambre affichée comme "occupée".
// La préférence est corrélée à la VILLE de la chambre réellement affectée
// (via room_hotel.city) plutôt qu'à une préférence unique globale — un
// voyageur peut avoir demandé un hôtel différent par ville (Mecque ET
// Médine, §3quattuorvicies) — comparer à la bonne ville évite un faux
// "mismatch" quand la chambre affectée est dans une ville où il n'avait
// justement pas exprimé de préférence différente.
//
// ⚠️ Le SELECT expose rra.room_id (jamais r.room_id, colonne dépréciée)
// sous l'alias `room_id` — HebergementManager.jsx groupe les occupants par
// cette clé (occupantsByRoom.set(a.room_id, ...)), une valeur obsolète y
// romprait silencieusement l'affichage des occupants par chambre.
//
// La préférence effective (registration_hotel_preferences OU le tarif
// d'hébergement choisi, voir effectiveHotelPreferences ci-dessus) est
// calculée en JS plutôt qu'en SQL corrélé : une inscription avec un tarif
// n'a généralement PAS de ligne registration_hotel_preferences (retirée du
// formulaire une fois un tarif choisi, §3unquadragies), un simple LEFT JOIN
// SQL ratait donc systématiquement l'alerte de préférence non respectée
// pour ces inscriptions.
export async function listAssignedRegistrationsForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT rra.room_id, r.id, r.preferred_room_type, r.selected_tier_id,
            r.group_id, rg.label AS group_label, rg.allow_mixed_gender_room,
            tr.full_name, tr.gender, room_hotel.city AS room_city
     FROM registration_room_assignments rra
     JOIN registrations r ON r.id = rra.registration_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN rooms rm ON rm.id = rra.room_id
     JOIN trip_hotels th ON th.id = rm.trip_hotel_id
     JOIN hotels room_hotel ON room_hotel.id = th.hotel_id
     WHERE r.trip_id = ? AND r.agency_id = ? AND rra.agency_id = ? AND r.status != 'annule'
     ORDER BY tr.full_name ASC`,
    [tripId, agencyId, agencyId]
  );

  const preferences = await listHotelPreferencesForTrip(tripId);
  const preferencesByRegistration = new Map();
  for (const pref of preferences) {
    if (!preferencesByRegistration.has(pref.registration_id)) {
      preferencesByRegistration.set(pref.registration_id, []);
    }
    preferencesByRegistration.get(pref.registration_id).push(pref);
  }

  const tiers = await listTiersForTrip(tripId);
  const tiersById = new Map(tiers.map((t) => [t.id, t]));

  return rows.map((r) => {
    const effectivePrefs = effectiveHotelPreferences(
      r,
      preferencesByRegistration.get(r.id) || [],
      tiersById
    );
    const match = effectivePrefs.find((p) => p.city === r.room_city);
    return {
      ...r,
      preferred_hotel_id: match?.hotel_id ?? null,
      preferred_hotel_name: match?.hotel_name ?? null,
    };
  });
}

// --- Affectation manuelle avec logique anti-conflit ---

// Additif par ville : n'affecte/ne remplace que la ville de la chambre
// choisie (dérivée de la chambre elle-même) — ne touche jamais
// l'affectation d'une AUTRE ville pour la même inscription. Permet donc
// d'appeler cette fonction une fois par ville pour un même voyageur
// (Mecque puis Médine) sans que la deuxième n'écrase la première.
export async function assignRegistrationToRoom(registrationId, roomId) {
  return assignRegistrationsToRoom([registrationId], roomId);
}

// Version multi-inscriptions, en UNE transaction : sert aussi bien à
// l'affectation d'un seul voyageur qu'au transfert d'un groupe entier vers
// une autre chambre (tout passe ou rien ne bouge — jamais un groupe à moitié
// déplacé). L'upsert par ville remplace l'ancienne chambre de la même ville,
// ce qui fait de cette fonction un vrai "transfert" quand le voyageur était
// déjà affecté (même hôtel ou autre hôtel de la même ville).
export async function assignRegistrationsToRoom(registrationIds, roomId) {
  const agencyId = await resolveAgencyId();
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const registrations = [];
    for (const registrationId of registrationIds) {
      const [[registration]] = await connection.execute(
        `SELECT r.id, r.trip_id, r.group_id, tr.gender, rg.allow_mixed_gender_room
         FROM registrations r
         JOIN travelers tr ON tr.id = r.traveler_id
         LEFT JOIN registration_groups rg ON rg.id = r.group_id
         WHERE r.id = ? AND r.agency_id = ? FOR UPDATE`,
        [registrationId, agencyId]
      );
      if (!registration) {
        throw new Error("Inscription introuvable");
      }
      registrations.push(registration);
    }

    const [[room]] = await connection.execute(
      `SELECT rm.id, rm.capacity, th.trip_id, h.city
       FROM rooms rm
       JOIN trip_hotels th ON th.id = rm.trip_hotel_id
       JOIN hotels h ON h.id = th.hotel_id
       WHERE rm.id = ? AND rm.agency_id = ? FOR UPDATE`,
      [roomId, agencyId]
    );

    if (!room) {
      throw new Error("Chambre introuvable");
    }

    for (const registration of registrations) {
      if (room.trip_id !== registration.trip_id) {
        throw new Error("Cette chambre appartient à un autre voyage");
      }
    }

    // Occupants actuels de la chambre, hors les inscriptions qu'on est en
    // train de déplacer (elles peuvent déjà y être, et libèrent leur place).
    const placeholders = registrationIds.map(() => "?").join(", ");
    const [existingOccupants] = await connection.execute(
      `SELECT tr.gender, reg.group_id
       FROM registration_room_assignments rra
       JOIN registrations reg ON reg.id = rra.registration_id
       JOIN travelers tr ON tr.id = reg.traveler_id
       WHERE rra.room_id = ? AND rra.agency_id = ? AND reg.status != 'annule' AND reg.id NOT IN (${placeholders})`,
      [roomId, agencyId, ...registrationIds]
    );

    if (existingOccupants.length + registrations.length > room.capacity) {
      throw new Error("Chambre complète");
    }

    // Non-mixité : seule exception, un couple/famille du même groupe
    // (registration_groups.allow_mixed_gender_room) peut partager une
    // chambre entre genres différents — jamais une mixité générale de la
    // chambre avec des occupants extérieurs au groupe. Évaluée sur
    // l'occupation FINALE de la chambre (occupants restants + déplacés).
    const finalOccupants = [
      ...existingOccupants,
      ...registrations.map((r) => ({ gender: r.gender, group_id: r.group_id })),
    ];
    for (const registration of registrations) {
      const otherGenderOccupants = finalOccupants.filter((o) => o.gender !== registration.gender);
      if (otherGenderOccupants.length > 0) {
        const exceptionApplies =
          registration.group_id &&
          registration.allow_mixed_gender_room &&
          otherGenderOccupants.every((o) => o.group_id === registration.group_id);
        if (!exceptionApplies) {
          throw new Error("Chambre déjà occupée par l'autre genre");
        }
      }
    }

    for (const registration of registrations) {
      await connection.execute(
        `INSERT INTO registration_room_assignments (registration_id, city, room_id, agency_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE room_id = VALUES(room_id)`,
        [registration.id, room.city, roomId, agencyId]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  // Déclencheurs WhatsApp (après le commit, hors transaction).
  for (const registrationId of registrationIds) {
    await emitCrmEvent("chambre_affectee", { registrationId: Number(registrationId) });
  }
}

// "Retirer" désaffecte le voyageur de TOUTES les villes du voyage d'un
// coup (pas seulement celle du bouton cliqué, et dans les deux sens —
// retirer de Makka retire aussi de Médine, et vice versa) — décision
// explicite de l'utilisateur : laisser un voyageur à moitié affecté (encore
// logé dans une ville après avoir été retiré d'une autre) était source de
// confusion, "Retirer" remet toute sa répartition hébergement à zéro pour
// ce voyage plutôt qu'un retrait ville par ville.
export async function unassignRegistrationFromTrip(registrationId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("registrations", registrationId, agencyId);
  await query(
    `DELETE FROM registration_room_assignments WHERE registration_id = ? AND agency_id = ?`,
    [registrationId, agencyId]
  );
}

// --- Répartition automatique ---
// Un voyage multi-villes a besoin d'une chambre PAR VILLE (voir CLAUDE.md)
// — la boucle gloutonne d'origine (remplit les chambres partielles en
// premier, priorise la préférence exprimée, traite le genre le plus
// nombreux d'abord) est rejouée une fois PAR VILLE, sur le sous-ensemble de
// chambres et d'inscriptions encore à affecter POUR CETTE VILLE
// (missingCities) — sans ça, une ville traitée en second (alphabétiquement
// après une autre) ne recevait jamais aucune affectation, puisque chaque
// inscription ne pouvait avoir qu'une seule chambre au total.
export async function autoAssignTrip(tripId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  const rooms = await listRoomsForTrip(tripId);
  const unassigned = await listUnassignedRegistrations(tripId);

  const cities = [...new Set(rooms.map((r) => r.hotel_city))];

  // assignedCount/skippedCount comptent par tentative (inscription, ville) —
  // un voyageur bi-ville compte pour 2 s'il reçoit une chambre dans chaque
  // ville. travelersAssignedIds regroupe par inscription pour donner un
  // compte de VOYAGEURS distincts, affiché à l'écran (HebergementManager.jsx)
  // — sans ça, "4 voyageur(s) affecté(s)" pour 2 personnes bi-villes
  // affectées dans leurs 2 villes chacune induisait le personnel en erreur.
  let assignedCount = 0;
  let skippedCount = 0;
  const travelersAssignedIds = new Set();

  for (const city of cities) {
    const roomState = rooms
      .filter((r) => r.hotel_city === city)
      .map((r) => ({
        id: r.id,
        hotelId: r.hotel_id,
        roomType: r.room_type,
        capacity: r.capacity,
        occupants: Number(r.occupants_count),
        gender: r.occupants_gender || null,
      }));

    const cityRegs = unassigned.filter((reg) => reg.missingCities.includes(city));

    const byGender = { homme: [], femme: [] };
    for (const reg of cityRegs) {
      byGender[reg.gender].push(reg);
    }

    // Préférence exprimée POUR CETTE VILLE précisément (un voyageur peut
    // avoir une préférence à Médine mais aucune à Makka — la comparer sans
    // filtrer par ville la ferait compter à tort pour les deux).
    const preferenceForCity = (reg) => reg.hotelPreferences?.find((p) => p.city === city);
    const hasPreference = (reg) =>
      Boolean(preferenceForCity(reg) || reg.preferred_room_type);

    // Traite d'abord les voyageurs ayant exprimé une préférence (pour
    // cette ville) : sans ça, un voyageur sans préférence traité plus tôt
    // (ordre alphabétique) peut occuper la chambre qu'un voyageur avec
    // préférence, traité plus tard, avait explicitement demandée.
    for (const gender of ["homme", "femme"]) {
      byGender[gender].sort((a, b) => Number(hasPreference(b)) - Number(hasPreference(a)));
    }

    // Traite d'abord le groupe le plus nombreux : évite qu'un petit groupe
    // n'occupe une chambre mixte-libre et ne prive le groupe plus nombreux
    // d'une place dont il a davantage besoin.
    const genderOrder =
      byGender.femme.length > byGender.homme.length
        ? ["femme", "homme"]
        : ["homme", "femme"];

    for (const gender of genderOrder) {
      for (const reg of byGender[gender]) {
        const pref = preferenceForCity(reg);

        // Priorise une chambre correspondant à la préférence exprimée à
        // l'inscription : un score (hôtel + type = 3, un seul des deux = 1
        // ou 2, aucun = 0) évite qu'une chambre ne matchant que l'hôtel ne
        // batte une chambre matchant hôtel ET type via le seul tie-break de
        // remplissage. À score égal, retombe sur l'heuristique de
        // remplissage (comble les chambres partielles d'abord).
        const preferenceScore = (r) =>
          (pref && pref.hotel_id === r.hotelId ? 2 : 0) +
          (reg.preferred_room_type && r.roomType === reg.preferred_room_type ? 1 : 0);

        const candidate = roomState
          .filter(
            (r) =>
              r.occupants < r.capacity && (r.gender === null || r.gender === gender)
          )
          .sort((a, b) => {
            const scoreDiff = preferenceScore(b) - preferenceScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return a.capacity - a.occupants - (b.capacity - b.occupants);
          })[0];

        if (!candidate) {
          skippedCount += 1;
          continue;
        }

        await query(
          `INSERT INTO registration_room_assignments (registration_id, city, room_id, agency_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE room_id = VALUES(room_id)`,
          [reg.id, city, candidate.id, agencyId]
        );
        candidate.occupants += 1;
        candidate.gender = gender;
        assignedCount += 1;
        travelersAssignedIds.add(reg.id);
      }
    }
  }

  return { assignedCount, skippedCount, travelersAssignedCount: travelersAssignedIds.size };
}
