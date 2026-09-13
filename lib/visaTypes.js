import { query, getPool } from "./db";

export async function listVisaTypes() {
  return query(
    `SELECT vt.*, p.title AS program_title
     FROM visa_types vt
     LEFT JOIN programs p ON p.id = vt.program_id
     ORDER BY vt.program_id IS NULL DESC, vt.name ASC`
  );
}

export async function listVisaTypesForProgram(programId) {
  return query(
    `SELECT * FROM visa_types
     WHERE is_active = TRUE AND (program_id IS NULL OR program_id = ?)
     ORDER BY name ASC`,
    [programId]
  );
}

export async function getVisaTypeWithDocuments(id) {
  const [visaType] = await query(`SELECT * FROM visa_types WHERE id = ?`, [id]);
  if (!visaType) return null;

  const documents = await query(
    `SELECT * FROM visa_type_documents WHERE visa_type_id = ? ORDER BY sort_order ASC, id ASC`,
    [id]
  );
  return { ...visaType, documents };
}

export async function createVisaType(data) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO visa_types (name, country, program_id, price, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.name,
        data.country || null,
        data.programId || null,
        data.price || 0,
        data.description || null,
      ]
    );

    const visaTypeId = result.insertId;

    for (const [index, doc] of (data.documents || []).entries()) {
      if (!doc.name?.trim()) continue;
      await connection.execute(
        `INSERT INTO visa_type_documents (visa_type_id, document_name, is_required, sort_order)
         VALUES (?, ?, ?, ?)`,
        [visaTypeId, doc.name.trim(), doc.isRequired !== false, index]
      );
    }

    await connection.commit();
    return visaTypeId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateVisaType(id, data) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE visa_types SET name = ?, country = ?, program_id = ?, price = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [
        data.name,
        data.country || null,
        data.programId || null,
        data.price || 0,
        data.description || null,
        data.isActive !== false,
        id,
      ]
    );

    await connection.execute(`DELETE FROM visa_type_documents WHERE visa_type_id = ?`, [id]);

    for (const [index, doc] of (data.documents || []).entries()) {
      if (!doc.name?.trim()) continue;
      await connection.execute(
        `INSERT INTO visa_type_documents (visa_type_id, document_name, is_required, sort_order)
         VALUES (?, ?, ?, ?)`,
        [id, doc.name.trim(), doc.isRequired !== false, index]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function deleteVisaType(id) {
  await query(`DELETE FROM visa_types WHERE id = ?`, [id]);
}

export async function listProgramsForSelect() {
  return query(`SELECT id, title FROM programs ORDER BY title ASC`);
}

// --- Demandes de visa liées à une inscription ---

export async function getVisaRequestByRegistration(registrationId) {
  const [request] = await query(
    `SELECT * FROM visa_requests WHERE registration_id = ? LIMIT 1`,
    [registrationId]
  );
  if (!request) return null;

  const documents = await query(
    `SELECT vrd.*, vtd.document_name, vtd.is_required, vtd.sort_order
     FROM visa_request_documents vrd
     JOIN visa_type_documents vtd ON vtd.id = vrd.visa_type_document_id
     WHERE vrd.visa_request_id = ?
     ORDER BY vtd.sort_order ASC, vtd.id ASC`,
    [request.id]
  );

  return { ...request, documents };
}

export async function assignVisaTypeToRegistration(registrationId, visaTypeId) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id FROM visa_requests WHERE registration_id = ? LIMIT 1`,
      [registrationId]
    );

    let visaRequestId;
    if (existing.length > 0) {
      visaRequestId = existing[0].id;
      await connection.execute(
        `UPDATE visa_requests SET visa_type_id = ? WHERE id = ?`,
        [visaTypeId, visaRequestId]
      );
      await connection.execute(
        `DELETE FROM visa_request_documents WHERE visa_request_id = ?`,
        [visaRequestId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO visa_requests (registration_id, visa_type_id) VALUES (?, ?)`,
        [registrationId, visaTypeId]
      );
      visaRequestId = result.insertId;
    }

    const [docs] = await connection.execute(
      `SELECT id FROM visa_type_documents WHERE visa_type_id = ?`,
      [visaTypeId]
    );

    for (const doc of docs) {
      await connection.execute(
        `INSERT INTO visa_request_documents (visa_request_id, visa_type_document_id, status)
         VALUES (?, ?, 'manquant')`,
        [visaRequestId, doc.id]
      );
    }

    await connection.commit();
    return visaRequestId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function setDocumentStatus(visaRequestDocumentId, status) {
  await query(
    `UPDATE visa_request_documents
     SET status = ?, provided_at = ?
     WHERE id = ?`,
    [status, status === "fourni" ? new Date() : null, visaRequestDocumentId]
  );
}
