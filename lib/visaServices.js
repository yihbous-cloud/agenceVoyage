import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Service visa autonome (migration 013) : un client peut demander une aide
// visa indépendamment de tout voyage réservé chez l'agence — voir CLAUDE.md.

export async function listVisaServiceRequests({ status } = {}) {
  const agencyId = await resolveAgencyId();
  const conditions = ["vsr.agency_id = ?"];
  const params = [agencyId];
  if (status) {
    conditions.push("vsr.status = ?");
    params.push(status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return query(
    `-- agency-lint-ok: vsr.agency_id est la première condition du WHERE dynamique
     SELECT vsr.id, vsr.status, vsr.total_due, vsr.created_at, vsr.visa_type_id,
            tr.full_name, tr.phone_whatsapp,
            vt.name AS visa_type_name, vt.country,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.visa_service_id = vsr.id) AS total_paid
     FROM visa_service_requests vsr
     JOIN travelers tr ON tr.id = vsr.traveler_id
     JOIN visa_types vt ON vt.id = vsr.visa_type_id
     ${where}
     ORDER BY vsr.created_at DESC`,
    params
  );
}

// Compteurs par statut — alimente la carte "Service visa" du tableau de
// bord (voir CLAUDE.md), même principe que statusCounts de
// getDashboardStats() pour les inscriptions.
export async function getVisaServiceStats() {
  const agencyId = await resolveAgencyId();
  const statusCounts = await query(
    `SELECT status, COUNT(*) AS count FROM visa_service_requests WHERE agency_id = ? GROUP BY status`,
    [agencyId]
  );
  return { statusCounts };
}

export async function getVisaServiceRequestById(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `SELECT vsr.*, tr.full_name, tr.phone_whatsapp, tr.email AS traveler_email,
            vt.name AS visa_type_name, vt.country, vt.price AS visa_type_price
     FROM visa_service_requests vsr
     JOIN travelers tr ON tr.id = vsr.traveler_id
     JOIN visa_types vt ON vt.id = vsr.visa_type_id
     WHERE vsr.id = ? AND vsr.agency_id = ?
     LIMIT 1`,
    [id, agencyId]
  );
  const request = rows[0];
  if (!request) return null;

  const documents = await query(
    `SELECT vsd.*, vtd.document_name, vtd.is_required, vtd.sort_order
     FROM visa_service_documents vsd
     JOIN visa_type_documents vtd ON vtd.id = vsd.visa_type_document_id
     WHERE vsd.visa_service_request_id = ? AND vsd.agency_id = ?
     ORDER BY vtd.sort_order ASC, vtd.id ASC`,
    [id, agencyId]
  );

  return { ...request, documents };
}

// Crée (ou réutilise, par numéro WhatsApp — même logique que
// createRegistration) le voyageur, puis la demande de service visa, et
// génère la checklist de documents depuis le catalogue du type choisi
// (même logique qu'assignVisaTypeToRegistration côté inscriptions).
export async function createVisaServiceRequest(data, registeredByStaffId) {
  const agencyId = await resolveAgencyId();
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assertOwned("visa_types", data.visaTypeId, agencyId, connection);

    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? AND agency_id = ? LIMIT 1`,
      [data.phoneWhatsapp, agencyId]
    );

    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
      await connection.execute(
        `UPDATE travelers SET full_name = ?, email = ? WHERE id = ? AND agency_id = ?`,
        [data.fullName, data.email || null, travelerId, agencyId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers (full_name, gender, phone_whatsapp, email, agency_id)
         VALUES (?, ?, ?, ?, ?)`,
        [data.fullName, data.gender || "homme", data.phoneWhatsapp, data.email || null, agencyId]
      );
      travelerId = result.insertId;
    }

    // Montant dû par défaut = prix du type de visa choisi, pour ne pas
    // partir de 0 — reste modifiable ensuite (voir CLAUDE.md §3septendecies,
    // même principe que le montant dû d'une inscription).
    let totalDue = data.totalDue;
    if (totalDue === undefined || totalDue === null || totalDue === "") {
      const [[visaType]] = await connection.execute(
        `SELECT price FROM visa_types WHERE id = ? AND agency_id = ?`,
        [data.visaTypeId, agencyId]
      );
      totalDue = visaType ? visaType.price : 0;
    }

    const [result] = await connection.execute(
      `INSERT INTO visa_service_requests (traveler_id, visa_type_id, total_due, registered_by_staff_id, agency_id)
       VALUES (?, ?, ?, ?, ?)`,
      [travelerId, data.visaTypeId, totalDue, registeredByStaffId || null, agencyId]
    );
    const visaServiceId = result.insertId;

    const [docs] = await connection.execute(
      `SELECT id FROM visa_type_documents WHERE visa_type_id = ? AND agency_id = ?`,
      [data.visaTypeId, agencyId]
    );
    for (const doc of docs) {
      await connection.execute(
        `INSERT INTO visa_service_documents (visa_service_request_id, visa_type_document_id, status, agency_id)
         VALUES (?, ?, 'manquant', ?)`,
        [visaServiceId, doc.id, agencyId]
      );
    }

    await connection.commit();
    return visaServiceId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateVisaServiceRequest(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("visa_service_requests", id, agencyId);
  const fields = [];
  const params = [];
  const map = { status: "status", totalDue: "total_due", notes: "notes" };

  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key]);
    }
  }
  if (fields.length === 0) return getVisaServiceRequestById(id);

  params.push(id, agencyId);
  await query(
    `UPDATE visa_service_requests SET ${fields.join(", ")} WHERE id = ? AND agency_id = ?`,
    params
  );
  return getVisaServiceRequestById(id);
}

export async function setVisaServiceDocumentStatus(visaServiceDocumentId, status) {
  const agencyId = await resolveAgencyId();
  await assertOwned("visa_service_documents", visaServiceDocumentId, agencyId);
  await query(
    `UPDATE visa_service_documents
     SET status = ?, provided_at = ?
     WHERE id = ? AND agency_id = ?`,
    [status, status === "fourni" ? new Date() : null, visaServiceDocumentId, agencyId]
  );
}
