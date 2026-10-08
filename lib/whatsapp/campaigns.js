import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { buildCrmContext } from "./crmContext";
import { pickTemplateVariant, sendTemplateToConversationWithContext } from "./templates";
import { conversationFor, isAllowedTime, nextAllowedTime } from "./triggers";
import { getOpsSettings, priceForCategory } from "./ops";
import { notify } from "./team";

// Campagnes marketing (cahier §7.3, CP-01→06 ; CLAUDE.md §3centtroisquadragies).
//
// - Segment = filtres sur les contacts WhatsApp ; une campagne n'atteint
//   JAMAIS un contact sans consentement marketing ou bloqué (vérifié au
//   lancement ET juste avant chaque envoi : un « STOP » reçu entre-temps
//   retire le contact).
// - Circuit : brouillon → a_valider → validee → en_cours → terminee ;
//   refusee (retour en brouillon possible) ; arretee (arrêt d'urgence).
//   Seul un compte « whatsapp.campaigns.approve » valide ou lance.
// - Envoi progressif par le worker (file dédiée wa-campaigns, concurrence 1,
//   débit limité) : les réponses aux clients (file wa-inbound) ne sont
//   jamais retardées (NF-03). Plages d'envoi : 9h-21h, pas le vendredi
//   12h-14h (mêmes règles que les déclencheurs).
// - Test A/B : `ab_test_percent` % des destinataires reçoivent A ou B (moitié
//   chacun) ; après `ab_wait_hours`, la variante gagnante (réponses ou
//   lectures) part au reste.

export const CAMPAIGN_STATUS = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  validee: "Validée",
  en_cours: "En cours",
  terminee: "Terminée",
  arretee: "Arrêtée",
  refusee: "Refusée",
};

// Plage d'envoi des campagnes (marketing : jamais d'urgence).
const SENDING_WINDOW = { allowed_start: "09:00:00", allowed_end: "21:00:00", skip_friday_prayer: true, urgent: false };

const err = (message, code = "VALIDATION") => Object.assign(new Error(message), { code });
const parse = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
const toSql = (d) => new Date(d).toISOString().slice(0, 19).replace("T", " ");

// --- Segments ------------------------------------------------------------------

export const SEGMENT_FILTERS = {
  stages: "Étape du contact",
  travel_types: "Type de voyage d'intérêt",
  program_ids: "Programme",
  sources: "Source",
  languages: "Langue",
  city: "Ville",
  last_interaction: "Dernière interaction",
  former_pilgrims: "Anciens pèlerins",
};

function cleanFilters(f = {}) {
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 50) : []);
  const out = {
    stages: arr(f.stages),
    travel_types: arr(f.travel_types),
    program_ids: arr(f.program_ids).map(Number).filter(Boolean),
    sources: arr(f.sources),
    languages: arr(f.languages),
    city: String(f.city || "").trim().slice(0, 80),
    former_pilgrims: Boolean(f.former_pilgrims),
    last_interaction: null,
  };
  const li = f.last_interaction || {};
  if (["within", "older"].includes(li.mode) && Number(li.days) > 0) out.last_interaction = { mode: li.mode, days: Math.min(3650, Number(li.days)) };
  return out;
}

// Clause SQL (alias c = wa_contacts). Consentement et blocage TOUJOURS appliqués.
function segmentWhere(agencyId, filters) {
  const f = cleanFilters(filters);
  const where = ["c.agency_id = ?", "c.marketing_opt_in = TRUE", "c.blocked = FALSE"];
  const params = [agencyId];
  const inList = (col, values) => {
    where.push(`${col} IN (${values.map(() => "?").join(", ")})`);
    params.push(...values);
  };
  if (f.stages.length) inList("c.stage", f.stages);
  if (f.sources.length) inList("c.source", f.sources);
  if (f.languages.length) inList("c.language", f.languages);
  if (f.travel_types.length) {
    where.push(`(${f.travel_types.map(() => "LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.qualification, '$.type_voyage'))) LIKE ?").join(" OR ")})`);
    params.push(...f.travel_types.map((t) => `%${t.toLowerCase()}%`));
  }
  if (f.city) {
    where.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.qualification, '$.ville_depart'))) LIKE ?");
    params.push(`%${f.city.toLowerCase()}%`);
  }
  if (f.program_ids.length) {
    const marks = f.program_ids.map(() => "?").join(", ");
    where.push(`(EXISTS (SELECT 1 FROM registrations r JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
        WHERE r.traveler_id = c.traveler_id AND r.agency_id = c.agency_id AND t.program_id IN (${marks}))
      OR JSON_UNQUOTE(JSON_EXTRACT(c.qualification, '$.programme_slug')) IN
        (SELECT p.slug FROM programs p WHERE p.agency_id = c.agency_id AND p.id IN (${marks})))`);
    params.push(...f.program_ids, ...f.program_ids);
  }
  if (f.former_pilgrims) {
    where.push(`(c.stage = 'ancien' OR EXISTS (SELECT 1 FROM registrations r JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
        WHERE r.traveler_id = c.traveler_id AND r.agency_id = c.agency_id AND r.status <> 'annule' AND COALESCE(t.return_date, t.departure_date) < CURDATE()))`);
  }
  if (f.last_interaction) {
    if (f.last_interaction.mode === "within") where.push("c.last_inbound_at >= UTC_TIMESTAMP() - INTERVAL ? DAY");
    else where.push("(c.last_inbound_at IS NULL OR c.last_inbound_at < UTC_TIMESTAMP() - INTERVAL ? DAY)");
    params.push(f.last_interaction.days);
  }
  return { sql: where.join(" AND "), params, filters: f };
}

export async function previewSegment(filters, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const { sql, params } = segmentWhere(agencyId, filters);
  const [count] = await query(`SELECT COUNT(*) AS n FROM wa_contacts c WHERE ${sql} -- agency-lint-ok: agency_id imposé par le constructeur de filtres`, params);
  const sample = await query(
    `SELECT c.id, c.profile_name, c.phone, c.stage, c.language, c.source FROM wa_contacts c WHERE ${sql} ORDER BY c.last_inbound_at DESC LIMIT 20 -- agency-lint-ok: agency_id imposé par le constructeur de filtres`,
    params
  );
  return { count: Number(count.n), sample };
}

export async function listSegments(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM wa_segments WHERE agency_id = ? ORDER BY name`, [agencyId]);
  return rows.map((r) => ({ ...r, filters: cleanFilters(parse(r.filters, {})) }));
}

export async function saveSegment(data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const name = String(data.name || "").trim().slice(0, 150);
  if (!name) throw err("Le nom du segment est obligatoire.");
  const filters = JSON.stringify(cleanFilters(data.filters));
  if (data.id) {
    await assertOwned("wa_segments", data.id, agencyId);
    await query(`UPDATE wa_segments SET name = ?, filters = ? WHERE id = ? AND agency_id = ?`, [name, filters, data.id, agencyId]);
    return Number(data.id);
  }
  const r = await query(`INSERT INTO wa_segments (agency_id, name, filters, created_by_staff_id) VALUES (?, ?, ?, ?)`, [agencyId, name, filters, staffId || null]);
  return r.insertId;
}

export async function deleteSegment(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_segments", id, agencyId);
  await query(`DELETE FROM wa_segments WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// --- Campagnes : préparation -----------------------------------------------

function normalizeCampaign(row) {
  if (!row) return null;
  return {
    ...row,
    filters: cleanFilters(parse(row.filters, {})),
    ab_test_percent: Number(row.ab_test_percent),
    ab_wait_hours: Number(row.ab_wait_hours),
    batch_size: Number(row.batch_size),
    estimated_recipients: row.estimated_recipients == null ? null : Number(row.estimated_recipients),
    estimated_cost: row.estimated_cost == null ? null : Number(row.estimated_cost),
  };
}

export async function getCampaign(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [row] = await query(
    `SELECT cp.*, cr.full_name AS created_by_name, ap.full_name AS approved_by_name, sp.full_name AS stopped_by_name
     FROM wa_campaigns cp
     LEFT JOIN staff_users cr ON cr.id = cp.created_by_staff_id AND cr.agency_id = cp.agency_id
     LEFT JOIN staff_users ap ON ap.id = cp.approved_by_staff_id AND ap.agency_id = cp.agency_id
     LEFT JOIN staff_users sp ON sp.id = cp.stopped_by_staff_id AND sp.agency_id = cp.agency_id
     WHERE cp.id = ? AND cp.agency_id = ?`,
    [id, agencyId]
  );
  if (!row) throw err("Ressource introuvable", "NOT_FOUND");
  return normalizeCampaign(row);
}

export async function listCampaigns(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT cp.*,
       (SELECT COUNT(*) FROM wa_campaign_recipients r WHERE r.campaign_id = cp.id AND r.agency_id = cp.agency_id) AS recipients,
       (SELECT COUNT(*) FROM wa_campaign_recipients r WHERE r.campaign_id = cp.id AND r.agency_id = cp.agency_id AND r.status = 'envoye') AS sent
     FROM wa_campaigns cp WHERE cp.agency_id = ? ORDER BY cp.id DESC`,
    [agencyId]
  );
  return rows.map(normalizeCampaign);
}

// Estimation (CP-04) : destinataires actuels du segment × prix Meta de la
// catégorie du template (A). Le coût réel est relevé dans les statuts Meta.
export async function estimateCampaign({ filters, template_name }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const { count } = await previewSegment(filters, agencyId);
  const variant = template_name ? await pickTemplateVariant(agencyId, template_name, "fr", { approvedOnly: false }) : null;
  const category = (variant?.category || variant?.category_requested || "MARKETING").toLowerCase();
  const settings = await getOpsSettings(agencyId);
  const unit = priceForCategory(settings, category);
  return { recipients: count, category, unitPrice: unit, cost: Math.round(count * unit * 100) / 100 };
}

async function validateCampaignInput(agencyId, data) {
  const name = String(data.name || "").trim().slice(0, 150);
  if (!name) throw err("Le nom de la campagne est obligatoire.");
  if (!data.template_name) throw err("Choisir le template à envoyer.");
  const a = await pickTemplateVariant(agencyId, data.template_name, "fr", { approvedOnly: false });
  if (!a) throw err(`Template « ${data.template_name} » introuvable.`);
  if (data.template_b_name) {
    if (data.template_b_name === data.template_name) throw err("Les variantes A et B doivent utiliser deux templates différents.");
    if (!(await pickTemplateVariant(agencyId, data.template_b_name, "fr", { approvedOnly: false }))) throw err(`Template « ${data.template_b_name} » introuvable.`);
  }
  const ab = data.template_b_name ? Math.min(50, Math.max(2, Number(data.ab_test_percent) || 10)) : 0;
  const scheduled = data.scheduled_at ? new Date(data.scheduled_at) : null;
  if (scheduled && Number.isNaN(scheduled.getTime())) throw err("Date d'envoi invalide.");
  if (data.segment_id) await assertOwned("wa_segments", data.segment_id, agencyId);
  return {
    name,
    segment_id: data.segment_id ? Number(data.segment_id) : null,
    filters: cleanFilters(data.filters),
    template_name: String(data.template_name),
    template_b_name: data.template_b_name ? String(data.template_b_name) : null,
    free_text: data.free_text ? String(data.free_text).trim().slice(0, 500) : null,
    ab_test_percent: ab,
    ab_wait_hours: Math.min(72, Math.max(1, Number(data.ab_wait_hours) || 4)),
    ab_metric: data.ab_metric === "lus" ? "lus" : "reponses",
    scheduled_at: scheduled ? toSql(scheduled) : null,
    batch_size: Math.min(1000, Math.max(10, Number(data.batch_size) || 200)),
  };
}

export async function saveCampaign(data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const v = await validateCampaignInput(agencyId, data);
  const estimate = await estimateCampaign({ filters: v.filters, template_name: v.template_name }, agencyId);
  const values = [
    v.name, v.segment_id, JSON.stringify(v.filters), v.template_name, v.template_b_name, v.free_text, v.ab_test_percent,
    v.ab_wait_hours, v.ab_metric, v.scheduled_at, v.batch_size, estimate.recipients, estimate.cost,
  ];
  if (data.id) {
    const current = await getCampaign(data.id, agencyId);
    if (!["brouillon", "refusee"].includes(current.status)) throw err("Seule une campagne en brouillon ou refusée peut être modifiée.");
    await query(
      `UPDATE wa_campaigns SET name = ?, segment_id = ?, filters = ?, template_name = ?, template_b_name = ?, free_text = ?,
         ab_test_percent = ?, ab_wait_hours = ?, ab_metric = ?, scheduled_at = ?, batch_size = ?, estimated_recipients = ?,
         estimated_cost = ?, status = 'brouillon', review_note = NULL
       WHERE id = ? AND agency_id = ?`,
      [...values, data.id, agencyId]
    );
    return Number(data.id);
  }
  const r = await query(
    `INSERT INTO wa_campaigns (name, segment_id, filters, template_name, template_b_name, free_text, ab_test_percent,
       ab_wait_hours, ab_metric, scheduled_at, batch_size, estimated_recipients, estimated_cost, agency_id, created_by_staff_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values, agencyId, staffId || null]
  );
  return r.insertId;
}

export async function deleteCampaign(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const c = await getCampaign(id, agencyId);
  if (!["brouillon", "refusee"].includes(c.status)) throw err("Seule une campagne jamais lancée peut être supprimée.");
  await query(`DELETE FROM wa_campaigns WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// --- Circuit de validation (CP-03) ------------------------------------------------

async function transition(agencyId, id, from, to, extraSql = "", extraParams = []) {
  const r = await query(
    `UPDATE wa_campaigns SET status = ?${extraSql} WHERE id = ? AND agency_id = ? AND status IN (${from.map(() => "?").join(", ")})`,
    [to, ...extraParams, id, agencyId, ...from]
  );
  if (!r.affectedRows) throw err("Action impossible dans l'état actuel de la campagne.", "CONFLICT");
}

export async function submitCampaign(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const c = await getCampaign(id, agencyId);
  const a = await pickTemplateVariant(agencyId, c.template_name, "fr");
  if (!a) throw err("Le template A n'est approuvé par Meta dans aucune langue : impossible de soumettre la campagne.");
  if (c.template_b_name && !(await pickTemplateVariant(agencyId, c.template_b_name, "fr"))) throw err("Le template B n'est pas approuvé par Meta.");
  const estimate = await estimateCampaign(c, agencyId);
  if (!estimate.recipients) throw err("Aucun contact consentant dans ce segment.");
  await transition(agencyId, id, ["brouillon", "refusee"], "a_valider", ", submitted_at = UTC_TIMESTAMP(), estimated_recipients = ?, estimated_cost = ?", [
    estimate.recipients,
    estimate.cost,
  ]);
  await notify({ team: "direction", kind: "campagne", title: `Campagne à valider : ${c.name} (${estimate.recipients} contacts, ~${estimate.cost} MAD)` }, agencyId);
}

export async function approveCampaign(id, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await transition(agencyId, id, ["a_valider"], "validee", ", approved_by_staff_id = ?, approved_at = UTC_TIMESTAMP(), review_note = NULL", [staffId || null]);
}

export async function rejectCampaign(id, note, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await transition(agencyId, id, ["a_valider", "validee"], "refusee", ", review_note = ?", [String(note || "").slice(0, 500) || null]);
}

// Arrêt d'urgence (CP-05) : plus aucun envoi, destinataires restants annulés.
export async function stopCampaign(id, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await transition(agencyId, id, ["validee", "en_cours"], "arretee", ", stopped_by_staff_id = ?, stopped_at = UTC_TIMESTAMP(), finished_at = UTC_TIMESTAMP()", [
    staffId || null,
  ]);
  await query(`UPDATE wa_campaign_recipients SET status = 'annule', result = 'campagne arrêtée' WHERE campaign_id = ? AND agency_id = ? AND status = 'en_attente'`, [
    id,
    agencyId,
  ]);
}

// --- Exécution (worker) -----------------------------------------------------------

// Fige la liste des destinataires et répartit le test A/B.
async function startCampaign(agencyId, c) {
  const { sql, params } = segmentWhere(agencyId, c.filters);
  const contacts = await query(`SELECT c.id FROM wa_contacts c WHERE ${sql} ORDER BY RAND() -- agency-lint-ok: agency_id imposé par le constructeur de filtres`, params);
  const ids = contacts.map((r) => r.id);
  const testCount = c.template_b_name && c.ab_test_percent ? Math.max(2, Math.round((ids.length * c.ab_test_percent) / 100)) : 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((contactId, k) => {
      const index = i + k;
      const test = index < testCount;
      return [agencyId, c.id, contactId, test ? (index % 2 === 0 ? "A" : "B") : "A", test ? "test" : "principal"];
    });
    await query(
      `INSERT IGNORE INTO wa_campaign_recipients (agency_id, campaign_id, contact_id, variant, phase) VALUES ${chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
      chunk.flat()
    );
  }
  await query(`UPDATE wa_campaigns SET status = 'en_cours', started_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ? AND status = 'validee'`, [c.id, agencyId]);
  return ids.length;
}

// Résultat du test A/B : taux de réponses (ou de lectures) par variante.
async function abScores(agencyId, campaignId, metric) {
  const rows = await query(
    `SELECT r.variant, COUNT(*) AS sent,
       SUM(CASE WHEN m.status = 'lu' THEN 1 ELSE 0 END) AS reads_count,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM wa_messages i WHERE i.conversation_id = m.conversation_id AND i.agency_id = m.agency_id
             AND i.direction = 'entrant' AND i.created_at >= r.sent_at) THEN 1 ELSE 0 END) AS replies
     FROM wa_campaign_recipients r
     JOIN wa_messages m ON m.id = r.message_id AND m.agency_id = r.agency_id
     WHERE r.campaign_id = ? AND r.agency_id = ? AND r.phase = 'test' AND r.status = 'envoye'
     GROUP BY r.variant`,
    [campaignId, agencyId]
  );
  const score = (v) => {
    const row = rows.find((r) => r.variant === v);
    if (!row || !Number(row.sent)) return 0;
    return Number(metric === "lus" ? row.reads_count : row.replies) / Number(row.sent);
  };
  return { A: score("A"), B: score("B"), rows };
}

async function sendToRecipient(agencyId, c, recipient) {
  const [contact] = await query(`SELECT * FROM wa_contacts WHERE id = ? AND agency_id = ?`, [recipient.contact_id, agencyId]);
  const skip = async (result) =>
    query(`UPDATE wa_campaign_recipients SET status = 'ignore', result = ? WHERE id = ? AND agency_id = ?`, [result, recipient.id, agencyId]);
  if (!contact) return skip("contact supprimé");
  if (contact.blocked) return skip("contact bloqué");
  if (!contact.marketing_opt_in) return skip("consentement marketing retiré");
  const templateName = recipient.variant === "B" && c.template_b_name ? c.template_b_name : c.template_name;
  const template = await pickTemplateVariant(agencyId, templateName, contact.language);
  if (!template) return skip(`aucune version approuvée de « ${templateName} »`);
  const [reg] = contact.traveler_id
    ? await query(`SELECT id FROM registrations WHERE traveler_id = ? AND agency_id = ? AND status <> 'annule' ORDER BY id DESC LIMIT 1`, [
        contact.traveler_id,
        agencyId,
      ])
    : [null];
  const context = await buildCrmContext(agencyId, {
    contactId: contact.id,
    registrationId: reg?.id || null,
    extra: c.free_text ? { "texte.libre": c.free_text } : {},
  });
  const conversationId = await conversationFor(agencyId, contact.id);
  try {
    const sent = await sendTemplateToConversationWithContext(agencyId, conversationId, template, context, { author: "systeme", campaignId: c.id });
    await query(`UPDATE wa_campaign_recipients SET status = 'envoye', message_id = ?, sent_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [
      sent.messageId,
      recipient.id,
      agencyId,
    ]);
  } catch (e) {
    await query(`UPDATE wa_campaign_recipients SET status = 'echec', result = ? WHERE id = ? AND agency_id = ?`, [String(e.message).slice(0, 255), recipient.id, agencyId]);
  }
}

// Un pas d'exécution d'une campagne (appelé par le worker, file wa-campaigns).
// Retourne un résumé ; ne lève pas d'erreur métier.
export async function runCampaignStep(agencyId, campaignId) {
  let c = await getCampaign(campaignId, agencyId);
  if (c.status === "validee") {
    if (c.scheduled_at && new Date(`${c.scheduled_at.replace(" ", "T")}Z`) > new Date()) return { waiting: "planifiée" };
    const count = await startCampaign(agencyId, c);
    if (!count) {
      await query(`UPDATE wa_campaigns SET status = 'terminee', finished_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [campaignId, agencyId]);
      return { finished: true, recipients: 0 };
    }
    c = await getCampaign(campaignId, agencyId);
  }
  if (c.status !== "en_cours") return { skipped: c.status };
  // WA_CAMPAIGN_IGNORE_HOURS=1 : scripts de recette uniquement (jamais en production).
  const ignoreHours = process.env.NODE_ENV !== "production" && process.env.WA_CAMPAIGN_IGNORE_HOURS === "1";
  if (!ignoreHours && !isAllowedTime(SENDING_WINDOW)) return { waiting: `hors plage d'envoi (reprise ${nextAllowedTime(SENDING_WINDOW).toISOString()})` };

  // Phase de test A/B d'abord.
  let phase = "principal";
  const [pendingTest] = await query(
    `SELECT COUNT(*) AS n FROM wa_campaign_recipients WHERE campaign_id = ? AND agency_id = ? AND phase = 'test' AND status = 'en_attente'`,
    [campaignId, agencyId]
  );
  if (Number(pendingTest.n) > 0) phase = "test";
  else if (c.template_b_name && c.ab_test_percent && !c.ab_winner) {
    if (!c.test_sent_at) {
      await query(`UPDATE wa_campaigns SET test_sent_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [campaignId, agencyId]);
      return { waiting: "test A/B envoyé, attente des résultats" };
    }
    const due = new Date(`${c.test_sent_at.replace(" ", "T")}Z`).getTime() + c.ab_wait_hours * 3600 * 1000;
    if (Date.now() < due) return { waiting: "test A/B en cours" };
    const scores = await abScores(agencyId, campaignId, c.ab_metric);
    const winner = scores.B > scores.A ? "B" : "A";
    await query(`UPDATE wa_campaigns SET ab_winner = ? WHERE id = ? AND agency_id = ?`, [winner, campaignId, agencyId]);
    await query(`UPDATE wa_campaign_recipients SET variant = ? WHERE campaign_id = ? AND agency_id = ? AND phase = 'principal' AND status = 'en_attente'`, [
      winner,
      campaignId,
      agencyId,
    ]);
    c.ab_winner = winner;
  }

  const batch = await query(
    `SELECT * FROM wa_campaign_recipients WHERE campaign_id = ? AND agency_id = ? AND status = 'en_attente' AND phase = ?
     ORDER BY id LIMIT ${Number(c.batch_size)}`,
    [campaignId, agencyId, phase]
  );
  let sent = 0;
  for (const recipient of batch) {
    // Arrêt d'urgence pris en compte entre deux messages.
    const [state] = await query(`SELECT status FROM wa_campaigns WHERE id = ? AND agency_id = ?`, [campaignId, agencyId]);
    if (state?.status !== "en_cours") return { stopped: true, sent };
    await sendToRecipient(agencyId, c, recipient);
    sent += 1;
  }
  const [left] = await query(`SELECT COUNT(*) AS n FROM wa_campaign_recipients WHERE campaign_id = ? AND agency_id = ? AND status = 'en_attente'`, [
    campaignId,
    agencyId,
  ]);
  if (!Number(left.n) && (!c.template_b_name || !c.ab_test_percent || c.ab_winner || phase === "principal")) {
    await query(`UPDATE wa_campaigns SET status = 'terminee', finished_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ? AND status = 'en_cours'`, [
      campaignId,
      agencyId,
    ]);
    await notify({ team: "direction", kind: "campagne", title: `Campagne terminée : ${c.name}` }, agencyId);
    return { finished: true, sent };
  }
  return { sent, phase };
}

// Campagnes à faire avancer (toutes agences, worker).
export async function listActiveCampaigns() {
  return query(
    `SELECT id, agency_id FROM wa_campaigns -- agency-lint-ok: balayage worker, agence portée par chaque ligne
     WHERE status IN ('validee', 'en_cours') ORDER BY id`
  );
}

// --- Résultats (CP-06) --------------------------------------------------------------

export async function campaignReport(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const c = await getCampaign(id, agencyId);
  const [s] = await query(
    `SELECT COUNT(*) AS recipients,
       SUM(r.status = 'envoye') AS sent,
       SUM(r.status = 'echec') AS failed,
       SUM(r.status = 'ignore') AS skipped,
       SUM(r.status IN ('en_attente')) AS pending,
       SUM(m.status IN ('livre', 'lu')) AS delivered,
       SUM(m.status = 'lu') AS read_count,
       SUM(CASE WHEN r.sent_at IS NOT NULL AND EXISTS (SELECT 1 FROM wa_messages i WHERE i.conversation_id = m.conversation_id AND i.agency_id = m.agency_id
             AND i.direction = 'entrant' AND i.created_at >= r.sent_at) THEN 1 ELSE 0 END) AS replies,
       SUM(CASE WHEN r.sent_at IS NOT NULL AND EXISTS (SELECT 1 FROM wa_consents k WHERE k.contact_id = r.contact_id AND k.agency_id = r.agency_id
             AND k.action = 'retrait' AND k.created_at >= r.sent_at) THEN 1 ELSE 0 END) AS unsubscribed,
       SUM(CASE WHEN r.sent_at IS NOT NULL AND EXISTS (SELECT 1 FROM wa_contacts ct JOIN registrations g ON g.traveler_id = ct.traveler_id AND g.agency_id = ct.agency_id
             WHERE ct.id = r.contact_id AND ct.agency_id = r.agency_id AND g.registration_date >= r.sent_at
               AND g.registration_date < r.sent_at + INTERVAL 60 DAY) THEN 1 ELSE 0 END) AS registrations,
       COALESCE(SUM(m.cost_mad), 0) AS real_cost,
       SUM(m.cost_mad IS NOT NULL) AS costed
     FROM wa_campaign_recipients r
     LEFT JOIN wa_messages m ON m.id = r.message_id AND m.agency_id = r.agency_id
     WHERE r.campaign_id = ? AND r.agency_id = ?`,
    [id, agencyId]
  );
  const num = (v) => Number(v || 0);
  const stats = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, num(v)]));
  // Coût : réel quand Meta l'a renseigné, sinon estimation au tarif.
  const settings = await getOpsSettings(agencyId);
  const unit = priceForCategory(settings, "marketing");
  stats.cost = stats.costed ? stats.real_cost + (stats.sent - stats.costed) * unit : stats.sent * unit;
  stats.cost_is_estimate = stats.costed < stats.sent;
  stats.cost_per_registration = stats.registrations ? Math.round((stats.cost / stats.registrations) * 100) / 100 : null;
  const ab = c.template_b_name ? await abScores(agencyId, id, c.ab_metric) : null;
  const responders = await query(
    `SELECT ct.id AS contact_id, ct.profile_name, ct.phone, ct.stage, r.variant, r.sent_at,
       (SELECT MAX(i.created_at) FROM wa_messages i WHERE i.conversation_id = m.conversation_id AND i.agency_id = m.agency_id
          AND i.direction = 'entrant' AND i.created_at >= r.sent_at) AS replied_at,
       m.conversation_id
     FROM wa_campaign_recipients r
     JOIN wa_messages m ON m.id = r.message_id AND m.agency_id = r.agency_id
     JOIN wa_contacts ct ON ct.id = r.contact_id AND ct.agency_id = r.agency_id
     WHERE r.campaign_id = ? AND r.agency_id = ? AND EXISTS (SELECT 1 FROM wa_messages i WHERE i.conversation_id = m.conversation_id
       AND i.agency_id = m.agency_id AND i.direction = 'entrant' AND i.created_at >= r.sent_at)
     ORDER BY replied_at DESC LIMIT 500`,
    [id, agencyId]
  );
  return { campaign: c, stats, ab, responders };
}
