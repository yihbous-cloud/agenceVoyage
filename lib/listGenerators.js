import { query } from "./db";

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
     WHERE reg.trip_id = ? AND reg.status != 'annule'
     ORDER BY tr.full_name ASC`,
    [tripId]
  );

  const requestIds = rows.map((r) => r.visa_request_id).filter(Boolean);
  let documentsByRequest = {};

  if (requestIds.length > 0) {
    const placeholders = requestIds.map(() => "?").join(", ");
    const docs = await query(
      `SELECT vrd.visa_request_id, vtd.document_name, vrd.status
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
  return query(`SELECT * FROM v_trip_airline_list WHERE trip_id = ?`, [tripId]);
}

export async function getTripAirlineTemplateKey(tripId) {
  const rows = await query(
    `SELECT a.export_template_key
     FROM trips t
     LEFT JOIN airlines a ON a.id = t.airline_id
     WHERE t.id = ?`,
    [tripId]
  );
  return rows[0]?.export_template_key || "generic_template";
}
