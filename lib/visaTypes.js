import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

export async function listVisaTypes() {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT vt.*, p.title AS program_title
     FROM visa_types vt
     LEFT JOIN programs p ON p.id = vt.program_id
     WHERE vt.agency_id = ?
     ORDER BY vt.program_id IS NULL DESC, vt.name ASC`,
    [agencyId]
  );
}

export async function listVisaTypesForProgram(programId) {
  const agencyId = await resolveAgencyId();
  return query(
    `SELECT * FROM visa_types
     WHERE is_active = TRUE AND agency_id = ? AND (program_id IS NULL OR program_id = ?)
     ORDER BY name ASC`,
    [agencyId, programId]
  );
}

// Pour le service visa autonome (hors voyage) : le choix se fait par
// destination, pas par programme — voir CLAUDE.md.
export async function listActiveVisaTypes() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM visa_types WHERE is_active = TRUE AND agency_id = ? ORDER BY name ASC`, [
    agencyId,
  ]);
}

export async function getVisaTypeWithDocuments(id) {
  const agencyId = await resolveAgencyId();
  const [visaType] = await query(`SELECT * FROM visa_types WHERE id = ? AND agency_id = ?`, [
    id,
    agencyId,
  ]);
  if (!visaType) return null;

  const documents = await query(
    `SELECT * FROM visa_type_documents WHERE visa_type_id = ? AND agency_id = ? ORDER BY sort_order ASC, id ASC`,
    [id, agencyId]
  );
  return { ...visaType, documents };
}

export async function createVisaType(data) {
  const agencyId = await resolveAgencyId();
  if (data.programId) await assertOwned("programs", data.programId, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO visa_types (name, country, program_id, price, description, agency_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.country || null,
        data.programId || null,
        data.price || 0,
        data.description || null,
        agencyId,
      ]
    );

    const visaTypeId = result.insertId;

    for (const [index, doc] of (data.documents || []).entries()) {
      if (!doc.name?.trim()) continue;
      await connection.execute(
        `INSERT INTO visa_type_documents (visa_type_id, document_name, is_required, sort_order, agency_id)
         VALUES (?, ?, ?, ?, ?)`,
        [visaTypeId, doc.name.trim(), doc.isRequired !== false, index, agencyId]
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
  const agencyId = await resolveAgencyId();
  await assertOwned("visa_types", id, agencyId);
  if (data.programId) await assertOwned("programs", data.programId, agencyId);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE visa_types SET name = ?, country = ?, program_id = ?, price = ?, description = ?, is_active = ?
       WHERE id = ? AND agency_id = ?`,
      [
        data.name,
        data.country || null,
        data.programId || null,
        data.price || 0,
        data.description || null,
        data.isActive !== false,
        id,
        agencyId,
      ]
    );

    await connection.execute(
      `DELETE FROM visa_type_documents WHERE visa_type_id = ? AND agency_id = ?`,
      [id, agencyId]
    );

    for (const [index, doc] of (data.documents || []).entries()) {
      if (!doc.name?.trim()) continue;
      await connection.execute(
        `INSERT INTO visa_type_documents (visa_type_id, document_name, is_required, sort_order, agency_id)
         VALUES (?, ?, ?, ?, ?)`,
        [id, doc.name.trim(), doc.isRequired !== false, index, agencyId]
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
  const agencyId = await resolveAgencyId();
  await assertOwned("visa_types", id, agencyId);
  await query(`DELETE FROM visa_types WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

export async function listProgramsForSelect() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT id, title FROM programs WHERE agency_id = ? ORDER BY title ASC`, [agencyId]);
}
