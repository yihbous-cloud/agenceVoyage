import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned, assertAllOwned } from "./agencyContext";
import { setHotelPreferencesForRegistration } from "./registrationHotelPreferences";
import { pickTripPrice } from "./roomTypes";
import { reserveTierRoomTypeCapacity } from "./tripHotelTiers";
import { recalculateGroupTotalDue, ensureGroupResponsible } from "./registrationGroups";
import { setPhoneNumbersForTraveler } from "./travelerPhoneNumbers";
import { tripArchivedSql } from "./tripArchive";
import { emitCrmEvent } from "./events";

export async function getDashboardStats() {
  const agencyId = await resolveAgencyId();
  const [statusCounts] = await Promise.all([
    // Voyages en cours uniquement : les inscrits des voyages clôturés
    // (archivés, lib/tripArchive.js) ne gonflent plus les compteurs.
    query(
      `SELECT r.status, COUNT(*) AS count
       FROM registrations r
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       WHERE r.agency_id = ? AND NOT ${tripArchivedSql("t")}
       GROUP BY r.status`,
      [agencyId]
    ),
  ]);

  // Aéroports + date de retour (arrivée) et compte par statut de paiement,
  // pour le tableau de bord "Prochains départs" — voir CLAUDE.md. Le
  // LEFT JOIN registrations (déjà filtré r.status != 'annule') sert de
  // base aux deux COUNT(CASE ...) : pas de fan-out supplémentaire (un seul
  // JOIN), chaque inscrit n'est compté qu'une fois.
  const upcomingTrips = await query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date, t.status,
            t.origin_iata, t.destination_iata, t.pnr, t.airline_id, p.id AS program_id, p.title,
            COUNT(r.id) AS registered_count, t.total_seats,
            COUNT(CASE WHEN r.status = 'paye_partiel' THEN 1 END) AS paye_partiel_count,
            COUNT(CASE WHEN r.status = 'paye_complet' THEN 1 END) AS paye_complet_count
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registrations r ON r.trip_id = t.id AND r.status != 'annule'
     WHERE t.departure_date >= CURDATE() AND t.agency_id = ?
     GROUP BY t.id
     ORDER BY t.departure_date ASC`,
    [agencyId]
  );

  return { statusCounts, upcomingTrips };
}

// Pastille "Inscrits" de la barre latérale admin : inscriptions non annulées.
export async function countActiveRegistrations() {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM registrations r
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     WHERE r.agency_id = ? AND r.status != 'annule' AND NOT ${tripArchivedSql("t")}`,
    [agencyId]
  );
  return Number(rows[0]?.count || 0);
}

// archived : true = voyages clôturés uniquement, false = voyages en cours
// uniquement, undefined = tous (lib/tripArchive.js).
export async function listRegistrations({ tripId, status, q, archived } = {}) {
  const agencyId = await resolveAgencyId();
  const conditions = ["r.agency_id = ?"];
  const params = [agencyId];

  if (tripId) {
    conditions.push("r.trip_id = ?");
    params.push(tripId);
  }
  if (status) {
    conditions.push("r.status = ?");
    params.push(status);
  }
  if (archived === true) conditions.push(tripArchivedSql("t"));
  if (archived === false) conditions.push(`NOT ${tripArchivedSql("t")}`);
  if (q) {
    // Recherche par nom du voyageur OU par nom du groupe/binôme auquel il
    // appartient (registration_groups.label) — un même champ de recherche
    // couvre les deux cas, voir CLAUDE.md.
    conditions.push("(tr.full_name LIKE ? OR tr.full_name_arabic LIKE ? OR rg.label LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query(
    `-- agency-lint-ok: r.agency_id est la première condition du WHERE dynamique
     SELECT r.id, r.status, r.visa_status, r.total_due, r.registration_date,
            tr.id AS traveler_id, tr.full_name, tr.full_name_arabic, tr.phone_whatsapp, tr.phone, tr.passport_number,
            t.id AS trip_id, t.reference_code, t.departure_date, t.return_date, t.status AS trip_status, t.pnr,
            p.id AS program_id, p.title AS program_title,
            r.group_id, rg.label AS group_label
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN trips t ON t.id = r.trip_id
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     ${where}
     ORDER BY p.title ASC, t.departure_date ASC, t.id ASC, r.registration_date ASC, r.id ASC`,
    params
  );
}

export async function getRegistrationById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT r.*, tr.full_name, tr.full_name_arabic, tr.gender, tr.date_of_birth,
            tr.national_id, tr.passport_number, tr.passport_issue_date, tr.passport_expiry_date, tr.info_confirmed,
            tr.phone_whatsapp, tr.phone, tr.email AS traveler_email, tr.address,
            t.reference_code, t.departure_date, t.return_date, t.flight_ticket_price,
            p.id AS program_id, p.title AS program_title, p.family AS program_family,
            rg.label AS group_label, rg.allow_mixed_gender_room
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id
     JOIN trips t ON t.id = r.trip_id
     JOIN programs p ON p.id = t.program_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id
     WHERE r.id = ? AND r.agency_id = ?
     LIMIT 1`,
    [id, agencyId]
  );
  return rows[0] || null;
}

export async function createRegistration(data) {
  const agencyId = await resolveAgencyId();
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Tout identifiant venu du client doit appartenir à NOTRE agence : une
    // clé étrangère valide en base ne prouve pas que la ressource est à nous.
    await assertOwned("trips", data.tripId, agencyId, connection);
    if (data.groupId) await assertOwned("registration_groups", data.groupId, agencyId, connection);
    if (data.selectedTierId) {
      await assertOwned("trip_hotel_tiers", data.selectedTierId, agencyId, connection);
    }
    if (Array.isArray(data.hotelPreferences)) {
      await assertAllOwned(
        "hotels",
        data.hotelPreferences.filter((p) => p.hotelId).map((p) => p.hotelId),
        agencyId,
        connection
      );
    }

    // Un tarif d'hébergement (trip_hotel_tiers, Omra/Hajj uniquement, voir
    // CLAUDE.md) verrouille sa ligne de prix (FOR UPDATE) et fait échouer
    // l'inscription si le type de chambre demandé est complet pour ce
    // tarif — avant tout autre travail, pour ne pas insérer un voyageur
    // puis annuler (rollback) si la place n'est plus disponible.
    let tierPrice = null;
    if (data.selectedTierId) {
      tierPrice = await reserveTierRoomTypeCapacity(
        connection,
        data.selectedTierId,
        data.preferredRoomType
      );
    }

    // Montant dû par défaut = prix du tarif d'hébergement choisi, sinon prix
    // du voyage selon le type de chambre demandé (ou le prix le plus bas si
    // aucune préférence exprimée, voir CLAUDE.md), pour ne pas partir de 0
    // et obliger le personnel à le ressaisir — reste modifiable ensuite
    // (EditRegistrationForm.jsx). Un appelant peut toujours forcer un autre
    // montant via data.totalDue (ex. tarif négocié).
    let totalDue = data.totalDue;
    if (totalDue === undefined || totalDue === null || totalDue === "") {
      if (tierPrice !== null) {
        totalDue = tierPrice;
      } else {
        const [[trip]] = await connection.execute(
          `SELECT price_double, price_triple, price_quadruple, price_quintuple FROM trips WHERE id = ? AND agency_id = ?`,
          [data.tripId, agencyId]
        );
        totalDue = trip ? pickTripPrice(trip, data.preferredRoomType) : 0;
      }
    }

    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? AND agency_id = ? LIMIT 1`,
      [data.phoneWhatsapp, agencyId]
    );

    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
      await connection.execute(
        `UPDATE travelers SET full_name = ?, full_name_arabic = ?, gender = ?,
           date_of_birth = ?, national_id = ?, passport_number = ?,
           passport_issue_date = ?, passport_expiry_date = ?, phone = ?, email = ?, address = ?
         WHERE id = ? AND agency_id = ?`,
        [
          data.fullName,
          data.fullNameArabic || null,
          data.gender,
          data.dateOfBirth || null,
          data.nationalId || null,
          data.passportNumber || null,
          data.passportIssueDate || null,
          data.passportExpiryDate || null,
          data.phone || null,
          data.email || null,
          data.address || null,
          travelerId,
          agencyId,
        ]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers
           (full_name, full_name_arabic, gender, date_of_birth, national_id,
            passport_number, passport_issue_date, passport_expiry_date, phone_whatsapp, phone, email, address, agency_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.fullName,
          data.fullNameArabic || null,
          data.gender,
          data.dateOfBirth || null,
          data.nationalId || null,
          data.passportNumber || null,
          data.passportIssueDate || null,
          data.passportExpiryDate || null,
          data.phoneWhatsapp,
          data.phone || null,
          data.email || null,
          data.address || null,
          agencyId,
        ]
      );
      travelerId = result.insertId;
    }

    const [registrationResult] = await connection.execute(
      `INSERT INTO registrations
         (trip_id, traveler_id, registered_by_staff_id, status, total_due, notes,
          preferred_room_type, group_id, selected_tier_id, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tripId,
        travelerId,
        data.registeredByStaffId || null,
        data.status || "inscrit",
        totalDue,
        data.notes || null,
        data.preferredRoomType || null,
        data.groupId || null,
        data.selectedTierId || null,
        agencyId,
      ]
    );
    const registrationId = registrationResult.insertId;

    // Une préférence d'hôtel par ville (§3quaterdecies/§3quattuorvicies) —
    // hotelPreferences : [{ city, hotelId }].
    if (Array.isArray(data.hotelPreferences)) {
      for (const pref of data.hotelPreferences) {
        if (!pref.hotelId) continue;
        await connection.execute(
          `INSERT INTO registration_hotel_preferences (registration_id, city, hotel_id, agency_id)
           VALUES (?, ?, ?, ?)`,
          [registrationId, pref.city, pref.hotelId, agencyId]
        );
      }
    }

    await connection.commit();

    // ⚠️ Numéros supplémentaires (setPhoneNumbersForTraveler) et recalcul du
    // groupe : volontairement APRÈS le commit, jamais dans la transaction
    // ci-dessus. setPhoneNumbersForTraveler ouvre sa PROPRE connexion —
    // l'appeler avant le commit ferait attendre cette deuxième connexion sur
    // le verrou de ligne posé par la première (jamais relâché tant qu'elle
    // n'a pas fini), un deadlock/blocage garanti.
    if (Array.isArray(data.additionalPhoneNumbers)) {
      await setPhoneNumbersForTraveler(travelerId, data.additionalPhoneNumbers);
    }

    // Recalcul automatique du montant dû du groupe (§3cinquanteneufquadragies)
    // — somme du prix de chaque membre selon son propre tarif/type de
    // chambre — hors transaction (purement dérivé, aucun risque à le
    // recalculer juste après le commit plutôt que dans la même transaction).
    // ensureGroupResponsible : le premier membre inséré devient responsable
    // par défaut (sans champ à remplir à la création, voir CLAUDE.md) —
    // idempotent, ne touche rien si un responsable valide existe déjà.
    if (data.groupId) {
      await recalculateGroupTotalDue(data.groupId);
      await ensureGroupResponsible(data.groupId);
    }

    // Déclencheurs WhatsApp (lib/events.js) — n'échoue jamais.
    await emitCrmEvent("inscription_creee", { registrationId });

    return { id: registrationId, travelerId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateRegistration(id, data) {
  const agencyId = await resolveAgencyId();
  // La ressource ciblée ET toute référence du payload doivent être à nous.
  await assertOwned("registrations", id, agencyId);
  if (data.groupId) await assertOwned("registration_groups", data.groupId, agencyId);
  if (data.selectedTierId) await assertOwned("trip_hotel_tiers", data.selectedTierId, agencyId);
  if (Array.isArray(data.hotelPreferences)) {
    await assertAllOwned(
      "hotels",
      data.hotelPreferences.filter((p) => p.hotelId).map((p) => p.hotelId),
      agencyId
    );
  }
  const map = {
    status: "status",
    visaStatus: "visa_status",
    totalDue: "total_due",
    roomId: "room_id",
    notes: "notes",
    preferredRoomType: "preferred_room_type",
    groupId: "group_id",
    selectedTierId: "selected_tier_id",
  };

  // Recalcul automatique du montant dû du groupe (§3cinquanteneufquadragies)
  // dès que la composition du groupe, le statut (une annulation retire un
  // membre du décompte, voir recalculateGroupTotalDue) ou le tarif/type de
  // chambre d'un membre change. Capture le groupe D'AVANT la mise à jour
  // AVANT d'appliquer les champs — un membre qui QUITTE un groupe doit
  // encore recalculer l'ancien groupe (plus ce membre), pas seulement le
  // nouveau.
  const affectsGroupPricing =
    data.groupId !== undefined ||
    data.selectedTierId !== undefined ||
    data.preferredRoomType !== undefined ||
    data.status !== undefined;
  let previousGroupId = null;
  if (affectsGroupPricing) {
    const [current] = await query(
      `SELECT group_id FROM registrations WHERE id = ? AND agency_id = ?`,
      [id, agencyId]
    );
    previousGroupId = current?.group_id ?? null;
  }

  const fields = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id, agencyId);
    const sql = `UPDATE registrations SET ${fields.join(", ")} WHERE id = ? AND agency_id = ?`;

    // Un changement de tarif d'hébergement revérifie la capacité comme à la
    // création (reserveTierRoomTypeCapacity, lib/tripHotelTiers.js), dans la
    // même transaction que l'UPDATE pour rester atomique face à une
    // modification concurrente ; l'inscription en cours d'édition est
    // exclue de son propre décompte (voir le commentaire de cette fonction).
    if (data.selectedTierId !== undefined && data.selectedTierId) {
      const pool = getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await reserveTierRoomTypeCapacity(connection, data.selectedTierId, data.preferredRoomType, id);
        await connection.execute(sql, params);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      await query(sql, params);
    }
  }

  // Une préférence d'hôtel par ville — hotelPreferences : [{ city, hotelId }].
  if (Array.isArray(data.hotelPreferences)) {
    await setHotelPreferencesForRegistration(id, data.hotelPreferences);
  }

  if (affectsGroupPricing) {
    const newGroupId = data.groupId !== undefined ? data.groupId : previousGroupId;
    const groupsToRecalculate = new Set([previousGroupId, newGroupId].filter(Boolean));
    for (const groupId of groupsToRecalculate) {
      await recalculateGroupTotalDue(groupId);
    }
    // Un membre qui quitte/rejoint un groupe peut laisser l'ancien groupe
    // sans responsable valide (ou le nouveau groupe sans aucun) — même
    // garde-fou idempotent qu'à la création, uniquement quand
    // l'appartenance au groupe change réellement.
    if (data.groupId !== undefined) {
      for (const groupId of groupsToRecalculate) {
        await ensureGroupResponsible(groupId);
      }
    }
  }

  // Déclencheurs WhatsApp : statut visa modifié (visa_en_cours, visa_accorde,
  // visa_refuse). Un même événement n'envoie qu'une fois (déduplication).
  if (data.visaStatus && data.visaStatus !== "non_demande") {
    await emitCrmEvent(`visa_${data.visaStatus}`, { registrationId: Number(id) });
  }

  return getRegistrationById(id);
}

// ⚠️ Étendu (carte "Informations Voyageurs") : persistait auparavant
// seulement 6 champs alors que full_name_arabic/date_of_birth/national_id/
// address existent en base depuis la création (NewRegistrationForm.jsx) —
// les rendre éditables ici sans étendre cet UPDATE les aurait laissés
// silencieusement non sauvegardés.
export async function updateTraveler(travelerId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("travelers", travelerId, agencyId);
  await query(
    `UPDATE travelers SET full_name = ?, full_name_arabic = ?, date_of_birth = ?,
       national_id = ?, address = ?, phone_whatsapp = ?, phone = ?, gender = ?,
       passport_number = ?, passport_issue_date = ?, passport_expiry_date = ?, email = ?, info_confirmed = TRUE
     WHERE id = ? AND agency_id = ?`,
    [
      data.fullName,
      data.fullNameArabic || null,
      data.dateOfBirth || null,
      data.nationalId || null,
      data.address || null,
      data.phoneWhatsapp,
      data.phone || null,
      data.gender,
      data.passportNumber || null,
      data.passportIssueDate || null,
      data.passportExpiryDate || null,
      data.email || null,
      travelerId,
      agencyId,
    ]
  );

  if (Array.isArray(data.additionalPhoneNumbers)) {
    await setPhoneNumbersForTraveler(travelerId, data.additionalPhoneNumbers);
  }
}

export async function deleteRegistration(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("registrations", id, agencyId);
  const [current] = await query(
    `SELECT group_id FROM registrations WHERE id = ? AND agency_id = ?`,
    [id, agencyId]
  );
  const groupId = current?.group_id ?? null;

  await query(`DELETE FROM registrations WHERE id = ? AND agency_id = ?`, [id, agencyId]);

  // Recalcul automatique du montant dû du groupe (§3cinquanteneufquadragies)
  // — un membre supprimé ne doit plus compter dans le total. La FK
  // ON DELETE SET NULL a déjà nettoyé responsible_registration_id si ce
  // membre était le responsable — ensureGroupResponsible réattribue alors
  // un remplaçant plutôt que de laisser le groupe sans point de contact.
  if (groupId) {
    await recalculateGroupTotalDue(groupId);
    await ensureGroupResponsible(groupId);
  }
}

export async function listOpenTripsForSelect() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date, t.program_id,
            t.origin_iata, t.destination_iata, t.destination_city, t.destination_country,
            t.price_double, t.price_triple, t.price_quadruple, t.price_quintuple, t.currency,
            p.title, p.family
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.status IN ('ouvert', 'planifie') AND t.agency_id = ? AND NOT ${tripArchivedSql("t")}
     ORDER BY t.departure_date ASC`,
    [agencyId]
  );
}
