import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { youtubeId, youtubeWatchUrl } from "./videoUrls";

// Photos et vidéo d'une fiche voyage — bloc « Preuves » (vague 2A, cahier
// §6.4, CLAUDE.md §3centdixseptquadragies). Photos envoyées par l'upload
// existant (/api/admin/upload), vidéo = lien YouTube.

const validationError = (message) => Object.assign(new Error(message), { code: "VALIDATION" });

const textOrNull = (value, max) => {
  const text = value == null ? "" : String(value).trim();
  return text === "" ? null : text.slice(0, max);
};

// Public (explicitAgencyId : page statique) et admin.
export async function listProgramMedia(programId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT id, program_id, kind, url, caption_fr, caption_ar, video_upload_date, sort_order
     FROM program_media WHERE program_id = ? AND agency_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [programId, agencyId]
  );
}

function normalizeMedia(data, agencyId) {
  const kind = data.kind === "video" ? "video" : "photo";
  let url = String(data.url || "").trim();
  if (kind === "photo") {
    // Une image envoyée par cette agence (ou un ancien envoi d'avant le
    // rangement des envois par agence).
    const ownUpload =
      url.startsWith(`/uploads/agencies/${agencyId}/`) || /^\/uploads\/(programs|agency|slider)\//.test(url);
    if (!/^\/uploads\/[\w./-]+$/.test(url) || url.includes("..") || !ownUpload) {
      throw validationError("Photo invalide : envoyez une image.");
    }
  } else {
    const id = youtubeId(url);
    if (!id) throw validationError("Lien vidéo invalide : collez un lien YouTube.");
    url = youtubeWatchUrl(id);
  }
  const uploadDate = String(data.videoUploadDate || "").trim();
  return {
    kind,
    url,
    caption_fr: textOrNull(data.captionFr, 255),
    caption_ar: textOrNull(data.captionAr, 255),
    video_upload_date: kind === "video" && /^\d{4}-\d{2}-\d{2}$/.test(uploadDate) ? uploadDate : null,
  };
}

export async function createProgramMedia(programId, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  const m = normalizeMedia(data, agencyId);
  const [{ next }] = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM program_media WHERE program_id = ? AND agency_id = ?`,
    [programId, agencyId]
  );
  const result = await query(
    `INSERT INTO program_media (agency_id, program_id, kind, url, caption_fr, caption_ar, video_upload_date, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [agencyId, programId, m.kind, m.url, m.caption_fr, m.caption_ar, m.video_upload_date, Number(next)]
  );
  return result.insertId;
}

// Légendes et date de la vidéo (l'image ou le lien ne changent pas : on
// supprime puis on ajoute).
export async function updateProgramMedia(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_media", id, agencyId);
  const uploadDate = String(data.videoUploadDate || "").trim();
  await query(
    `UPDATE program_media SET caption_fr = ?, caption_ar = ?,
       video_upload_date = IF(kind = 'video', ?, NULL)
     WHERE id = ? AND agency_id = ?`,
    [
      textOrNull(data.captionFr, 255),
      textOrNull(data.captionAr, 255),
      /^\d{4}-\d{2}-\d{2}$/.test(uploadDate) ? uploadDate : null,
      id,
      agencyId,
    ]
  );
}

export async function deleteProgramMedia(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("program_media", id, agencyId);
  await query(`DELETE FROM program_media WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// Nouvel ordre complet (ids dans l'ordre d'affichage), même programme.
export async function reorderProgramMedia(programId, orderedIds) {
  const agencyId = await resolveAgencyId();
  await assertOwned("programs", programId, agencyId);
  const ids = (orderedIds || []).map(Number).filter(Boolean);
  for (let i = 0; i < ids.length; i++) {
    await query(`UPDATE program_media SET sort_order = ? WHERE id = ? AND program_id = ? AND agency_id = ?`, [
      i,
      ids[i],
      programId,
      agencyId,
    ]);
  }
}

// Programme d'un média (revalidation avant/après suppression).
export async function programIdOfMedia(id) {
  const agencyId = await resolveAgencyId();
  const rows = await query(`SELECT program_id FROM program_media WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  return rows[0]?.program_id || null;
}
