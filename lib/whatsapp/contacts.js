import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { toWaId, phoneLookupVariants } from "./phone";

// Contacts et prospects WhatsApp (cahier §8.5) : liste filtrable, fiche,
// modification, import CSV (consentement OBLIGATOIRE par ligne), export.

export const STAGES = ["prospect", "qualifie", "inscrit", "en_voyage", "ancien", "perdu"];

function where(agencyId, f = {}) {
  const w = ["ct.agency_id = ?"];
  const params = [agencyId];
  if (f.q) {
    w.push("(ct.profile_name LIKE ? OR ct.phone LIKE ?)");
    params.push(`%${f.q}%`, `%${String(f.q).replace(/\D/g, "") || f.q}%`);
  }
  if (STAGES.includes(f.stage)) {
    w.push("ct.stage = ?");
    params.push(f.stage);
  }
  if (f.source) {
    w.push("ct.source = ?");
    params.push(f.source);
  }
  if (f.language) {
    w.push("ct.language = ?");
    params.push(f.language);
  }
  if (f.consent === "oui") w.push("ct.marketing_opt_in = TRUE");
  if (f.consent === "non") w.push("ct.marketing_opt_in = FALSE");
  if (f.blocked === "oui") w.push("ct.blocked = TRUE");
  if (f.advisor) {
    w.push("ct.advisor_staff_id = ?");
    params.push(Number(f.advisor));
  }
  return { sql: w.join(" AND "), params };
}

const SELECT = `SELECT ct.id, ct.phone, ct.profile_name, ct.language, ct.source, ct.stage, ct.marketing_opt_in, ct.blocked,
  ct.qualification, ct.last_inbound_at, ct.created_at, ct.traveler_id, su.full_name AS advisor_name,
  (SELECT MAX(c.id) FROM wa_conversations c WHERE c.contact_id = ct.id AND c.agency_id = ct.agency_id) AS last_conversation_id
  FROM wa_contacts ct LEFT JOIN staff_users su ON su.id = ct.advisor_staff_id AND su.agency_id = ct.agency_id`;

export async function listContacts(filters = {}, { limit = 50, offset = 0 } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const { sql, params } = where(agencyId, filters);
  const [count] = await query(`SELECT COUNT(*) AS n FROM wa_contacts ct WHERE ${sql} -- agency-lint-ok: agency_id imposé par le constructeur de filtres`, params);
  const rows = await query(
    `${SELECT} WHERE ${sql} ORDER BY COALESCE(ct.last_inbound_at, ct.created_at) DESC LIMIT ${Math.min(500, Number(limit) || 50)} OFFSET ${Math.max(0, Number(offset) || 0)}`,
    params
  );
  const sources = await query(`SELECT DISTINCT source FROM wa_contacts WHERE agency_id = ? AND source IS NOT NULL ORDER BY source`, [agencyId]);
  return { total: Number(count.n), rows, sources: sources.map((s) => s.source) };
}

export async function getContactDetail(contactId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_contacts", contactId, agencyId);
  const [contact] = await query(`${SELECT} WHERE ct.id = ? AND ct.agency_id = ?`, [contactId, agencyId]);
  const consents = await query(`SELECT action, source, text_shown, created_at FROM wa_consents WHERE contact_id = ? AND agency_id = ? ORDER BY id DESC`, [
    contactId,
    agencyId,
  ]);
  const conversations = await query(
    `SELECT id, status, team, transfer_reason, opened_at, resolved_at FROM wa_conversations WHERE contact_id = ? AND agency_id = ? ORDER BY id DESC LIMIT 20`,
    [contactId, agencyId]
  );
  const registrations = contact.traveler_id
    ? await query(
        `SELECT g.id, g.status, g.group_id, p.title AS program_title, t.departure_date FROM registrations g
         JOIN trips t ON t.id = g.trip_id AND t.agency_id = g.agency_id JOIN programs p ON p.id = t.program_id AND p.agency_id = g.agency_id
         WHERE g.traveler_id = ? AND g.agency_id = ? ORDER BY t.departure_date DESC`,
        [contact.traveler_id, agencyId]
      )
    : [];
  const media = await query(
    `SELECT md.id, md.kind, md.doc_type, md.created_at, md.purge_at, md.validated_at FROM wa_media md
     JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     WHERE c.contact_id = ? AND md.agency_id = ? ORDER BY md.id DESC LIMIT 50`,
    [contactId, agencyId]
  );
  const templates = await query(
    `SELECT m.created_at, t.name, m.status, cp.name AS campaign_name FROM wa_messages m
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     LEFT JOIN wa_templates t ON t.id = m.template_id AND t.agency_id = m.agency_id
     LEFT JOIN wa_campaigns cp ON cp.id = m.campaign_id AND cp.agency_id = m.agency_id
     WHERE c.contact_id = ? AND m.agency_id = ? AND m.type = 'template' ORDER BY m.id DESC LIMIT 50`,
    [contactId, agencyId]
  );
  return { contact, consents, conversations, registrations, media, templates };
}

// Modification depuis la fiche contact. Le consentement est historisé.
export async function updateContactById(contactId, data, staff, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_contacts", contactId, agencyId);
  const [before] = await query(`SELECT stage, advisor_staff_id, marketing_opt_in, blocked, profile_name, language FROM wa_contacts WHERE id = ? AND agency_id = ?`, [
    contactId,
    agencyId,
  ]);
  if (data.stage !== undefined) {
    if (!STAGES.includes(data.stage)) throw Object.assign(new Error("Étape invalide."), { code: "VALIDATION" });
    await query(`UPDATE wa_contacts SET stage = ? WHERE id = ? AND agency_id = ?`, [data.stage, contactId, agencyId]);
  }
  if (data.advisorStaffId !== undefined) {
    if (data.advisorStaffId) await assertOwned("staff_users", data.advisorStaffId, agencyId);
    await query(`UPDATE wa_contacts SET advisor_staff_id = ? WHERE id = ? AND agency_id = ?`, [data.advisorStaffId || null, contactId, agencyId]);
  }
  if (data.profileName !== undefined) {
    await query(`UPDATE wa_contacts SET profile_name = ? WHERE id = ? AND agency_id = ?`, [String(data.profileName || "").trim().slice(0, 150) || null, contactId, agencyId]);
  }
  if (data.language !== undefined) {
    await query(`UPDATE wa_contacts SET language = ? WHERE id = ? AND agency_id = ?`, [data.language || null, contactId, agencyId]);
  }
  if (data.blocked !== undefined) {
    await query(`UPDATE wa_contacts SET blocked = ? WHERE id = ? AND agency_id = ?`, [data.blocked ? 1 : 0, contactId, agencyId]);
  }
  if (data.marketingOptIn !== undefined && Boolean(data.marketingOptIn) !== Boolean(before.marketing_opt_in)) {
    await query(`UPDATE wa_contacts SET marketing_opt_in = ? WHERE id = ? AND agency_id = ?`, [data.marketingOptIn ? 1 : 0, contactId, agencyId]);
    await query(`INSERT INTO wa_consents (agency_id, contact_id, action, source, text_shown) VALUES (?, ?, ?, 'admin', ?)`, [
      agencyId,
      contactId,
      data.marketingOptIn ? "accord" : "retrait",
      String(data.consentText || `Modifié par ${staff?.fullName || "l'équipe"}`).slice(0, 1000),
    ]);
  }
  return before;
}

// --- CSV ------------------------------------------------------------------------

// Lecteur CSV minimal (séparateur , ou ; détecté sur l'en-tête, guillemets).
export function parseCsv(text) {
  const clean = String(text || "").replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

const HEADER_ALIASES = {
  phone: ["telephone", "téléphone", "phone", "numero", "numéro", "whatsapp", "tel"],
  name: ["nom", "name", "nom complet"],
  language: ["langue", "language"],
  source: ["source"],
  consent: ["consentement", "consent", "consentement marketing", "optin", "opt-in"],
  consentText: ["texte du consentement", "texte consentement", "consent_text", "preuve"],
};
const YES = new Set(["oui", "yes", "1", "true", "o", "y", "x", "نعم"]);
const LANGS = new Set(["darija_latin", "darija_arabe", "ar", "fr", "en"]);

// Import (§8.5) : la colonne de consentement est obligatoire ; seuls les
// « oui » activent le marketing, avec une trace dans wa_consents.
export async function importContactsCsv(text, staff, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = parseCsv(text);
  if (rows.length < 2) throw Object.assign(new Error("Fichier vide : une ligne d'en-tête puis une ligne par contact."), { code: "VALIDATION" });
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const col = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) col[key] = header.findIndex((h) => aliases.includes(h));
  if (col.phone < 0) throw Object.assign(new Error("Colonne « téléphone » introuvable."), { code: "VALIDATION" });
  if (col.consent < 0) throw Object.assign(new Error("Colonne « consentement » obligatoire (oui / non pour chaque contact)."), { code: "VALIDATION" });
  if (rows.length > 10001) throw Object.assign(new Error("10 000 contacts maximum par import."), { code: "VALIDATION" });
  const result = { created: 0, updated: 0, optedIn: 0, errors: [] };
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const get = (k) => (col[k] >= 0 ? String(r[col[k]] ?? "").trim() : "");
    const waId = toWaId(get("phone"));
    if (!waId || waId.length < 8 || waId.length > 15) {
      result.errors.push({ line: i + 1, message: `Numéro invalide : ${get("phone") || "(vide)"}` });
      continue;
    }
    const consentRaw = get("consent").toLowerCase();
    if (!consentRaw) {
      result.errors.push({ line: i + 1, message: "Consentement non renseigné (oui / non)" });
      continue;
    }
    const consent = YES.has(consentRaw);
    const language = LANGS.has(get("language")) ? get("language") : null;
    const [existing] = await query(`SELECT id, profile_name, marketing_opt_in FROM wa_contacts WHERE agency_id = ? AND phone = ?`, [agencyId, waId]);
    let contactId = existing?.id;
    if (existing) {
      await query(
        `UPDATE wa_contacts SET profile_name = COALESCE(profile_name, ?), language = COALESCE(language, ?), source = COALESCE(source, ?) WHERE id = ? AND agency_id = ?`,
        [get("name") || null, language, get("source") || null, existing.id, agencyId]
      );
      result.updated += 1;
    } else {
      const [traveler] = await query(
        `SELECT id FROM travelers WHERE agency_id = ? AND phone_whatsapp IN (${phoneLookupVariants(waId).map(() => "?").join(", ")}) LIMIT 1`,
        [agencyId, ...phoneLookupVariants(waId)]
      );
      const ins = await query(
        `INSERT INTO wa_contacts (agency_id, phone, profile_name, language, source, traveler_id, stage) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [agencyId, waId, get("name") || null, language, get("source") || "import", traveler?.id || null, traveler ? "inscrit" : "prospect"]
      );
      contactId = ins.insertId;
      result.created += 1;
    }
    if (consent && !existing?.marketing_opt_in) {
      await query(`UPDATE wa_contacts SET marketing_opt_in = TRUE WHERE id = ? AND agency_id = ?`, [contactId, agencyId]);
      await query(`INSERT INTO wa_consents (agency_id, contact_id, action, source, text_shown) VALUES (?, ?, 'accord', 'import', ?)`, [
        agencyId,
        contactId,
        (get("consentText") || `Import CSV par ${staff?.fullName || "l'équipe"}`).slice(0, 1000),
      ]);
      result.optedIn += 1;
    }
  }
  return result;
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(headers, rows) {
  return `﻿${[headers.map((h) => csvCell(h.label)).join(";"), ...rows.map((r) => headers.map((h) => csvCell(typeof h.value === "function" ? h.value(r) : r[h.key])).join(";"))].join("\r\n")}`;
}

export async function exportContactsCsv(filters = {}, explicitAgencyId) {
  const { rows } = await listContacts(filters, { limit: 500, offset: 0 }, explicitAgencyId);
  const all = [...rows];
  // Pagination interne : un export n'est pas limité à 500 lignes.
  for (let offset = 500; all.length === offset; offset += 500) {
    const more = await listContacts(filters, { limit: 500, offset }, explicitAgencyId);
    all.push(...more.rows);
    if (!more.rows.length) break;
  }
  return toCsv(
    [
      { label: "Téléphone", value: (r) => `+${r.phone}` },
      { label: "Nom", key: "profile_name" },
      { label: "Langue", key: "language" },
      { label: "Source", key: "source" },
      { label: "Étape", key: "stage" },
      { label: "Consentement marketing", value: (r) => (r.marketing_opt_in ? "oui" : "non") },
      { label: "Bloqué", value: (r) => (r.blocked ? "oui" : "non") },
      { label: "Conseiller", key: "advisor_name" },
      { label: "Dernier message", key: "last_inbound_at" },
      { label: "Créé le", key: "created_at" },
    ],
    all
  );
}
