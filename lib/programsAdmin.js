import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { slugify } from "./slugify";
import { tripArchivedSql } from "./tripArchive";
import { emitCrmEvent } from "./events";

export { slugify };

export async function listAllPrograms() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT p.*, COUNT(t.id) AS trips_count,
            COUNT(CASE WHEN t.status IN ('ouvert', 'planifie') AND NOT ${tripArchivedSql("t")} THEN 1 END) AS open_trips_count,
            -- Programme archivé : au moins un voyage et TOUS clôturés (lib/tripArchive.js)
            (COUNT(t.id) > 0 AND COUNT(CASE WHEN NOT ${tripArchivedSql("t")} THEN 1 END) = 0) AS is_archived,
            MAX(COALESCE(t.return_date, t.departure_date)) AS last_return_date
     FROM programs p
     LEFT JOIN trips t ON t.program_id = p.id AND t.agency_id = p.agency_id
     WHERE p.agency_id = ?
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [agencyId]
  );
}

export async function getProgramById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`SELECT * FROM programs WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  return rows[0] || null;
}

export async function createProgram(data) {
  const agencyId = await resolveAgencyId();
  const result = await query(
    `INSERT INTO programs
       (title, slug, program_type, family, season, theme, short_description, full_description,
        cover_image_url, is_published, meta_title, meta_description, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.slug,
      data.programType || "omra",
      data.family || "omra_hajj",
      data.family === "omra_hajj" ? data.season || null : null,
      data.family === "voyage_organise" ? data.theme || null : null,
      data.shortDescription || null,
      data.fullDescription || null,
      data.coverImageUrl || null,
      !!data.isPublished,
      data.metaTitle || null,
      data.metaDescription || null,
      agencyId,
    ]
  );
  return result.insertId;
}

// Mise à jour partielle : chaque carte de la page de gestion (§3novotrigies,
// voir CLAUDE.md) n'envoie que les champs qu'elle possède — seules les clés
// présentes dans `data` (!== undefined) sont incluses dans le UPDATE, tout le
// reste de la ligne reste intact. Même patron que updateRegistration
// (lib/registrations.js). `season` volontairement absent de cette map :
// champ déprécié (§3trigies), jamais réécrit depuis l'UI.
const PROGRAM_FIELD_MAP = {
  title: { column: "title" },
  slug: { column: "slug" },
  programType: { column: "program_type", transform: (v) => v || "omra" },
  family: { column: "family", transform: (v) => v || "omra_hajj" },
  theme: {
    column: "theme",
    transform: (v, data) => (data.family === "voyage_organise" ? v || null : null),
  },
  shortDescription: { column: "short_description", transform: (v) => v || null },
  fullDescription: { column: "full_description", transform: (v) => v || null },
  coverImageUrl: { column: "cover_image_url", transform: (v) => v || null },
  isPublished: { column: "is_published", transform: (v) => !!v },
  metaTitle: { column: "meta_title", transform: (v) => v || null },
  metaDescription: { column: "meta_description", transform: (v) => v || null },
};

export async function updateProgram(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", id, agencyId);
  const fields = [];
  const params = [];
  for (const [key, { column, transform }] of Object.entries(PROGRAM_FIELD_MAP)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(transform ? transform(data[key], data) : data[key]);
    }
  }
  if (fields.length === 0) return;
  params.push(id, agencyId);
  await query(`UPDATE programs SET ${fields.join(", ")} WHERE id = ? AND agency_id = ?`, params);
}

// Règle explicite : un programme n'est bloqué à la suppression que s'il a
// au moins un voyageur RÉELLEMENT inscrit (une ligne `registrations`, quel
// que soit son statut — y compris annulé, ça reste une vraie donnée
// voyageur) sur l'un de ses voyages. Un programme dont les voyages n'ont
// jamais reçu d'inscription (ex. programme de test créé puis abandonné)
// doit pouvoir être supprimé entièrement, voyages compris — la simple
// présence d'un voyage (sans inscrit) ne doit plus bloquer, contrairement
// au comportement précédent qui se contentait de laisser la contrainte de
// clé étrangère `trips.program_id` échouer brutalement.
export async function deleteProgram(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", id, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [countRows] = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM registrations r JOIN trips t ON t.id = r.trip_id WHERE t.program_id = ? AND t.agency_id = ?`,
      [id, agencyId]
    );
    if (countRows[0].cnt > 0) {
      const err = new Error("Des voyageurs sont inscrits à ce programme, suppression impossible");
      err.code = "PROGRAM_HAS_REGISTRATIONS";
      throw err;
    }

    const [tripRows] = await connection.execute(
      `SELECT id FROM trips WHERE program_id = ? AND agency_id = ?`,
      [id, agencyId]
    );
    const tripIds = tripRows.map((t) => t.id);

    if (tripIds.length > 0) {
      // Dépendances de `trips` sans ON DELETE CASCADE, à nettoyer avant de
      // supprimer les voyages — le reste (trip_hotels → rooms,
      // trip_hotel_tiers → trip_hotel_tier_prices) cascade automatiquement
      // (voir database/schema.sql). Sans inscription sur ces voyages (déjà
      // vérifié ci-dessus), `registration_groups`/`flight_bookings` ne
      // peuvent être que vides ou orphelins — jamais un vrai dossier voyageur.
      const placeholders = tripIds.map(() => "?").join(", ");
      // tripIds vient d'un SELECT déjà filtré par agence ci-dessus.
      await connection.execute(
        `DELETE FROM flight_bookings WHERE agency_id = ? AND trip_id IN (${placeholders})`,
        [agencyId, ...tripIds]
      );
      await connection.execute(
        `DELETE FROM trip_meal_offers WHERE agency_id = ? AND trip_id IN (${placeholders})`,
        [agencyId, ...tripIds]
      );
      await connection.execute(
        `DELETE FROM registration_groups WHERE agency_id = ? AND trip_id IN (${placeholders})`,
        [agencyId, ...tripIds]
      );
      await connection.execute(`DELETE FROM trips WHERE program_id = ? AND agency_id = ?`, [
        id,
        agencyId,
      ]);
    }

    // program_faqs/program_hotels cascadent automatiquement (ON DELETE
    // CASCADE) ; slides.program_id repasse à NULL (ON DELETE SET NULL).
    await connection.execute(`DELETE FROM programs WHERE id = ? AND agency_id = ?`, [id, agencyId]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// --- Voyages (trips) ---

export async function listTripsForProgram(programId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT t.*, a.name AS airline_name,
            COUNT(reg.id) AS registrations_count
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     LEFT JOIN registrations reg ON reg.trip_id = t.id AND reg.status != 'annule'
     WHERE t.program_id = ? AND t.agency_id = ?
     GROUP BY t.id
     ORDER BY t.departure_date DESC`,
    [programId, agencyId]
  );
}

export async function getTripFullById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT t.*, p.title AS program_title
     FROM trips t
     JOIN programs p ON p.id = t.program_id
     WHERE t.id = ? AND t.agency_id = ?`,
    [id, agencyId]
  );
  return rows[0] || null;
}

export async function createTrip(programId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  if (data.airlineId) await assertOwned("airlines", data.airlineId, agencyId);
  const result = await query(
    `INSERT INTO trips
       (program_id, reference_code, departure_date, return_date, destination_country, destination_city,
        origin_iata, destination_iata, outbound_layover_iata, return_layover_iata,
        return_origin_iata, return_destination_iata,
        airline_id, pnr, total_seats, price_double, price_triple, price_quadruple, price_quintuple,
        currency, status, notes, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      programId,
      data.referenceCode,
      data.departureDate,
      data.returnDate,
      data.destinationCountry || "Arabie Saoudite",
      data.destinationCity || null,
      data.originIata?.toUpperCase() || null,
      data.destinationIata?.toUpperCase() || null,
      data.outboundLayoverIata?.toUpperCase() || null,
      data.returnLayoverIata?.toUpperCase() || null,
      data.returnOriginIata?.toUpperCase() || null,
      data.returnDestinationIata?.toUpperCase() || null,
      data.airlineId || null,
      data.pnr?.trim().toUpperCase() || null,
      data.totalSeats || 0,
      data.priceDouble || 0,
      data.priceTriple || 0,
      data.priceQuadruple || 0,
      data.priceQuintuple || 0,
      data.currency || "MAD",
      data.status || "planifie",
      data.notes || null,
      agencyId,
    ]
  );
  const tripId = result.insertId;

  // Pas d'auto-attachement des hôtels par défaut du programme : une date par
  // défaut = toute la durée du voyage n'a pas de sens dès que le voyage a
  // plusieurs villes (deux hôtels ne peuvent pas couvrir la même période).
  // Chaque hôtel du voyage est désormais ajouté manuellement avec sa vraie
  // période depuis /admin/voyages/[tripId]/hebergement (voir CLAUDE.md).

  return tripId;
}

// Mise à jour partielle, même principe que PROGRAM_FIELD_MAP ci-dessus —
// chaque carte de la page de gestion (Informations/Aéroport/Tarification)
// n'envoie que ses propres champs (§3novotrigies, voir CLAUDE.md).
const TRIP_FIELD_MAP = {
  referenceCode: { column: "reference_code" },
  departureDate: { column: "departure_date" },
  returnDate: { column: "return_date" },
  destinationCountry: { column: "destination_country", transform: (v) => v || "Arabie Saoudite" },
  destinationCity: { column: "destination_city", transform: (v) => v || null },
  originIata: { column: "origin_iata", transform: (v) => v?.toUpperCase() || null },
  destinationIata: { column: "destination_iata", transform: (v) => v?.toUpperCase() || null },
  outboundLayoverIata: { column: "outbound_layover_iata", transform: (v) => v?.toUpperCase() || null },
  returnLayoverIata: { column: "return_layover_iata", transform: (v) => v?.toUpperCase() || null },
  returnOriginIata: { column: "return_origin_iata", transform: (v) => v?.toUpperCase() || null },
  returnDestinationIata: {
    column: "return_destination_iata",
    transform: (v) => v?.toUpperCase() || null,
  },
  airlineId: { column: "airline_id", transform: (v) => v || null },
  pnr: { column: "pnr", transform: (v) => v?.trim().toUpperCase() || null },
  totalSeats: { column: "total_seats", transform: (v) => v || 0 },
  priceDouble: { column: "price_double", transform: (v) => v || 0 },
  priceTriple: { column: "price_triple", transform: (v) => v || 0 },
  priceQuadruple: { column: "price_quadruple", transform: (v) => v || 0 },
  priceQuintuple: { column: "price_quintuple", transform: (v) => v || 0 },
  currency: { column: "currency", transform: (v) => v || "MAD" },
  status: { column: "status", transform: (v) => v || "planifie" },
  notes: { column: "notes", transform: (v) => v || null },
};

export async function updateTrip(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", id, agencyId);
  if (data.airlineId) await assertOwned("airlines", data.airlineId, agencyId);
  const fields = [];
  const params = [];
  for (const [key, { column, transform }] of Object.entries(TRIP_FIELD_MAP)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(transform ? transform(data[key]) : data[key]);
    }
  }
  if (fields.length === 0) return;
  params.push(id, agencyId);
  await query(`UPDATE trips SET ${fields.join(", ")} WHERE id = ? AND agency_id = ?`, params);
  // Déclencheurs WhatsApp : PNR renseigné = billets émis pour les inscrits.
  if (data.pnr) await emitCrmEvent("billet_emis", { tripId: Number(id) });
}

export async function deleteTrip(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", id, agencyId);
  await query(`DELETE FROM trips WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
