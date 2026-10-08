import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Liste d'hébergement — une ligne par CHAMBRE (répartition par groupe, par
// personne et par chambre, demande explicite) ; villes triées Makka en
// premier puis Madina, puis toute autre ville (escale-séjour, §3septtrigies)
// par ordre alphabétique — ordre demandé explicitement, indépendant des
// dates réelles du séjour (contrairement à listTripHotels, §3sextrigies, qui
// trie par date pour l'écran d'hébergement).
export const HEBERGEMENT_LIST_COLUMNS = [
  { key: "city", header: "Ville" },
  { key: "hotel_name", header: "Hôtel" },
  { key: "pack_label", header: "Packs" },
  { key: "room_number", header: "N° Chambre" },
  { key: "group_label", header: "Groupe" },
  { key: "occupants", header: "Voyageur(s)" },
];

export async function getHebergementDistributionList(tripId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT h.city, h.name AS hotel_name, r.room_number,
            GROUP_CONCAT(DISTINCT tht.label ORDER BY tht.label SEPARATOR ' + ') AS pack_label,
            GROUP_CONCAT(DISTINCT rg.label ORDER BY rg.label SEPARATOR ' + ') AS group_label,
            GROUP_CONCAT(DISTINCT tr.full_name ORDER BY tr.full_name SEPARATOR ', ') AS occupants
     FROM rooms r
     JOIN trip_hotels th ON th.id = r.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     LEFT JOIN registration_room_assignments rra ON rra.room_id = r.id
     LEFT JOIN registrations reg ON reg.id = rra.registration_id AND reg.status != 'annule'
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     LEFT JOIN registration_groups rg ON rg.id = reg.group_id
     LEFT JOIN trip_hotel_tiers tht ON tht.id = reg.selected_tier_id
     WHERE th.trip_id = ? AND r.agency_id = ?
     GROUP BY r.id
     ORDER BY CASE WHEN h.city = 'Makka' THEN 0 WHEN h.city = 'Madina' THEN 1 ELSE 2 END,
              h.city ASC, h.name ASC, r.room_number ASC`,
    [tripId, agencyId]
  );
}

// Variante "un tableau par hôtel" du PDF (§3soixanteseizequadragies,
// retouché en §3soixantedixhuitquadragies pour retirer le regroupement par
// pack) : une ligne par (chambre, occupant) — chaque voyageur sur sa propre
// ligne, avec son téléphone — plutôt qu'agrégée par chambre comme
// getHebergementDistributionList (toujours utilisée par l'Excel, qui garde
// sa colonne Packs). Une chambre vide (aucun occupant) produit une seule
// ligne avec traveler_name/traveler_phone à NULL.
export async function getHebergementRoomOccupants(tripId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT h.city, h.name AS hotel_name, r.room_number,
            tr.full_name AS traveler_name,
            COALESCE(tr.phone, tr.phone_whatsapp) AS traveler_phone
     FROM rooms r
     JOIN trip_hotels th ON th.id = r.trip_hotel_id
     JOIN hotels h ON h.id = th.hotel_id
     LEFT JOIN registration_room_assignments rra ON rra.room_id = r.id
     LEFT JOIN registrations reg ON reg.id = rra.registration_id AND reg.status != 'annule'
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id
     WHERE th.trip_id = ? AND r.agency_id = ?
     ORDER BY CASE WHEN h.city = 'Makka' THEN 0 WHEN h.city = 'Madina' THEN 1 ELSE 2 END,
              h.city ASC, h.name ASC, r.room_number ASC, tr.full_name ASC`,
    [tripId, agencyId]
  );
}

export const TRAVELER_LIST_COLUMNS = [
  { key: "full_name", header: "Nom complet" },
  { key: "full_name_arabic", header: "Nom (arabe)" },
  { key: "gender", header: "Genre" },
  { key: "date_of_birth", header: "Date de naissance" },
  { key: "passport_number", header: "N° Passeport" },
  { key: "passport_expiry_date", header: "Expiration passeport" },
  { key: "phone_whatsapp", header: "WhatsApp" },
  { key: "hotel_name", header: "Hôtel" },
  { key: "room_number", header: "Chambre" },
  { key: "room_type", header: "Type chambre" },
  { key: "registration_status", header: "Statut" },
  { key: "visa_status", header: "Visa" },
  { key: "total_due", header: "Montant dû" },
  { key: "total_paid", header: "Payé" },
  { key: "balance_due", header: "Solde" },
];

export async function getTravelerList(tripId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  return query(`SELECT * FROM v_trip_traveler_list WHERE trip_id = ?`, [tripId]);
}

export const VISA_LIST_COLUMNS = [
  { key: "full_name", header: "Nom complet" },
  { key: "full_name_arabic", header: "Nom (arabe)" },
  { key: "gender", header: "Genre" },
  { key: "date_of_birth", header: "Date de naissance" },
  { key: "passport_number", header: "N° Passeport" },
  { key: "passport_expiry_date", header: "Expiration passeport" },
  { key: "visa_type_name", header: "Type de visa" },
  { key: "consulate_or_authority", header: "Organisme" },
  { key: "submitted_date", header: "Date de dépôt" },
  { key: "status", header: "Statut" },
  { key: "documents_summary", header: "Documents" },
];

export async function getVisaRequestList(tripId) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT tr.full_name, tr.full_name_arabic, tr.gender, tr.date_of_birth,
            tr.passport_number, tr.passport_expiry_date,
            vt.name AS visa_type_name,
            vr.id AS visa_request_id,
            vr.consulate_or_authority, vr.submitted_date, vr.status
     FROM registrations reg
     JOIN travelers tr ON tr.id = reg.traveler_id
     LEFT JOIN visa_requests vr ON vr.registration_id = reg.id
     LEFT JOIN visa_types vt ON vt.id = vr.visa_type_id
     WHERE reg.trip_id = ? AND reg.agency_id = ? AND reg.status != 'annule'
     ORDER BY tr.full_name ASC`,
    [tripId, agencyId]
  );

  const requestIds = rows.map((r) => r.visa_request_id).filter(Boolean);
  let documentsByRequest = {};

  if (requestIds.length > 0) {
    const placeholders = requestIds.map(() => "?").join(", ");
    const docs = await query(
      `-- agency-lint-ok: visa_request_ids déjà issus d'inscriptions filtrées par agence
       SELECT vrd.visa_request_id, vtd.document_name, vrd.status
       FROM visa_request_documents vrd
       JOIN visa_type_documents vtd ON vtd.id = vrd.visa_type_document_id
       WHERE vrd.visa_request_id IN (${placeholders})`,
      requestIds
    );
    documentsByRequest = docs.reduce((acc, d) => {
      (acc[d.visa_request_id] ||= []).push(
        `${d.document_name}: ${d.status === "fourni" ? "OK" : "manquant"}`
      );
      return acc;
    }, {});
  }

  return rows.map((r) => ({
    ...r,
    status: r.status || "non_demande",
    documents_summary: (documentsByRequest[r.visa_request_id] || []).join(" | "),
  }));
}

export async function getAirlineList(tripId) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  return query(`SELECT * FROM v_trip_airline_list WHERE trip_id = ?`, [tripId]);
}

export async function getTripAirlineTemplateKey(tripId) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT a.export_template_key
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     WHERE t.id = ? AND t.agency_id = ?`,
    [tripId, agencyId]
  );
  return rows[0]?.export_template_key || "generic_template";
}

// Liste "compagnie aérienne avec PNR" (colonnes et formats au choix, voir
// lib/pnrListColumns.js) : tous les inscrits non annulés du voyage, avec le
// PNR saisi sur le voyage (trips.pnr). Valeurs BRUTES (dates "AAAA-MM-JJ",
// genre "homme"/"femme") — le format d'affichage choisi est appliqué par la
// route d'export, pas ici.
export async function getPnrPassengerList(tripId) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT t.pnr, t.departure_date, t.return_date,
            tr.full_name, tr.full_name_arabic, tr.gender, tr.date_of_birth,
            tr.passport_number, tr.passport_issue_date, tr.passport_expiry_date,
            tr.phone_whatsapp
     FROM registrations reg
     JOIN travelers tr ON tr.id = reg.traveler_id
     JOIN trips t ON t.id = reg.trip_id
     WHERE reg.trip_id = ? AND reg.agency_id = ? AND reg.status != 'annule'
       AND reg.package_type != 'hebergement_seul' -- sans billet : pas sur la liste compagnie
     ORDER BY tr.full_name ASC`,
    [tripId, agencyId]
  );
  return rows.map((r) => ({ ...r, pnr: r.pnr || "" }));
}
