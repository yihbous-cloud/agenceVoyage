import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { getAccountForAgency } from "./accounts";
import { normalizeWaId } from "./phone";

// Liens wa.me avec code source et QR code (CP-07, écran 8.7). Le message
// pré-rempli se termine par le code entre crochets — « [FLYER-RAMADAN] » —
// que la réception (lib/whatsapp/inbound.js) reconnaît pour attribuer la
// source au contact ; les statistiques comptent contacts, qualifiés, inscrits.

export const CODE_RE = /\[([A-Z0-9][A-Z0-9_-]{1,38})\]/;

function cleanCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function buildWaMeUrl(phone, message, code) {
  const digits = normalizeWaId(phone);
  const text = `${String(message || "").trim()} [${code}]`.trim();
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function listLinks(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const account = await getAccountForAgency(agencyId);
  const rows = await query(
    `SELECT l.*,
       (SELECT COUNT(*) FROM wa_contacts ct WHERE ct.agency_id = l.agency_id AND ct.source = CONCAT('lien:', l.code)) AS contacts,
       (SELECT COUNT(*) FROM wa_contacts ct WHERE ct.agency_id = l.agency_id AND ct.source = CONCAT('lien:', l.code)
          AND ct.stage IN ('qualifie', 'inscrit', 'en_voyage', 'ancien')) AS qualified,
       (SELECT COUNT(*) FROM wa_contacts ct WHERE ct.agency_id = l.agency_id AND ct.source = CONCAT('lien:', l.code)
          AND (ct.stage IN ('inscrit', 'en_voyage', 'ancien') OR ct.traveler_id IS NOT NULL)) AS registered
     FROM wa_links l WHERE l.agency_id = ? ORDER BY l.id DESC`,
    [agencyId]
  );
  const phone = account?.display_phone || null;
  return rows.map((l) => ({ ...l, is_active: Boolean(l.is_active), url: phone ? buildWaMeUrl(phone, l.prefilled_message, l.code) : null }));
}

export async function createLink(data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const code = cleanCode(data.code);
  const err = (m) => Object.assign(new Error(m), { code: "VALIDATION" });
  if (!/^[A-Z0-9][A-Z0-9_-]{1,38}$/.test(code)) throw err("Code source : 2 à 39 caractères (lettres, chiffres, - et _), ex. FLYER-RAMADAN.");
  if (!String(data.label || "").trim()) throw err("Le libellé est obligatoire.");
  if (!String(data.prefilledMessage || "").trim()) throw err("Le message pré-rempli est obligatoire.");
  try {
    const result = await query(
      `INSERT INTO wa_links (agency_id, code, label, prefilled_message, created_by_staff_id) VALUES (?, ?, ?, ?, ?)`,
      [agencyId, code, String(data.label).trim().slice(0, 150), String(data.prefilledMessage).trim().slice(0, 480), staffId || null]
    );
    return result.insertId;
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw err("Ce code source existe déjà.");
    throw e;
  }
}

export async function setLinkActive(id, active, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_links", id, agencyId);
  await query(`UPDATE wa_links SET is_active = ? WHERE id = ? AND agency_id = ?`, [active ? 1 : 0, id, agencyId]);
}

export async function getLink(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const links = await listLinks(agencyId);
  const link = links.find((l) => String(l.id) === String(id));
  if (!link) throw Object.assign(new Error("Ressource introuvable"), { code: "NOT_FOUND" });
  return link;
}

// Source d'un premier message : code d'un lien actif de l'agence, ou null.
export async function sourceFromMessage(connection, agencyId, text) {
  const m = CODE_RE.exec(String(text || ""));
  if (!m) return null;
  const [rows] = await connection.execute(`SELECT code FROM wa_links WHERE agency_id = ? AND code = ? AND is_active = TRUE`, [agencyId, m[1]]);
  return rows[0] ? `lien:${rows[0].code}` : null;
}
