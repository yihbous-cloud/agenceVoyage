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

// Pour le service visa autonome (hors voyage) : le choix se fait par
// destination, pas par programme — voir CLAUDE.md.
export async function listActiveVisaTypes() {
  return query(`SELECT * FROM visa_types WHERE is_active = TRUE ORDER BY name ASC`);
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
