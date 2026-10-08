import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { buildCrmContext } from "./crmContext";
import { pickTemplateVariant, renderTemplate, sendTemplateToConversationWithContext } from "./templates";
import { isServiceWindowOpen, sendConversationText } from "./outbound";
import { toWaId } from "./phone";
import { localParts, notify } from "./team";
import { CRM_EVENTS } from "../events";
import { deliverDailyReport } from "./reports";

// Moteur de déclencheurs (cahier §7.2, DC-01 à DC-10).
//   1. PLANIFICATION : un événement CRM (lib/events.js), le passage d'une
//      date relative (J-7 du départ...) ou une inactivité crée une exécution
//      `wa_trigger_runs` « planifie » (dédoublonnée par dedupe_key), à une
//      heure d'envoi autorisée (DC-06).
//   2. EXÉCUTION (worker, chaque minute) : juste avant l'envoi, conditions
//      d'arrêt (DC-05), consentement et plafonds marketing (DC-04), puis
//      texte libre GRATUIT si la fenêtre de 24h est ouverte (DC-03), sinon
//      template Meta approuvé dans la langue du contact (TP-04).
// Agence toujours explicite (le worker traite plusieurs agences).

export const FAMILIES = {
  evenement: "Événement CRM",
  date_relative: "Date relative (départ, retour, inscription)",
  inactivite: "Inactivité du client",
  interne: "Interne (équipe)",
  manuel: "Manuel (lancé depuis l'admin)",
};
export const EVENT_TYPES = CRM_EVENTS;
export const STOP_CONDITIONS = {
  reponse_client: "Le client a répondu",
  paiement_complet: "Dossier entièrement réglé",
  document_recu: "Le client a envoyé un document",
  visa_accorde: "Visa accordé",
  depart_passe: "Départ passé",
};
export const INTERNAL_ACTIONS = {
  notifier_equipe: "Notifier une équipe",
  rapport_quotidien: "Rapport quotidien (19h)",
};

const toSql = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const parse = (v, fallback) => (v == null ? fallback : typeof v === "object" ? v : JSON.parse(v));

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    conditions: parse(row.conditions, {}),
    stop_conditions: parse(row.stop_conditions, []),
    is_active: Boolean(row.is_active),
    urgent: Boolean(row.urgent),
    skip_friday_prayer: Boolean(row.skip_friday_prayer),
    free_text_when_open: Boolean(row.free_text_when_open),
  };
}

// --- Plages d'envoi autorisées (DC-06) --------------------------------------

const minutesOf = (time) => {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
};

export function isAllowedTime(trigger, date = new Date()) {
  if (trigger.urgent) return true;
  const { weekday, minutes } = localParts(date);
  if (minutes < minutesOf(trigger.allowed_start) || minutes >= minutesOf(trigger.allowed_end)) return false;
  if (trigger.skip_friday_prayer && weekday === 5 && minutes >= 12 * 60 && minutes < 14 * 60) return false;
  return true;
}

export function nextAllowedTime(trigger, from = new Date()) {
  if (isAllowedTime(trigger, from)) return from;
  for (let step = 1; step <= 8 * 24 * 12; step += 1) {
    const candidate = new Date(from.getTime() + step * 5 * 60 * 1000);
    if (isAllowedTime(trigger, candidate)) return candidate;
  }
  return from;
}

// --- CRUD --------------------------------------------------------------------

export async function listTriggers(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT t.*,
       (SELECT COUNT(*) FROM wa_trigger_runs r WHERE r.trigger_id = t.id AND r.agency_id = t.agency_id
          AND r.status = 'envoye' AND r.executed_at > UTC_TIMESTAMP() - INTERVAL 30 DAY) AS sent_30d,
       (SELECT COUNT(*) FROM wa_trigger_runs r WHERE r.trigger_id = t.id AND r.agency_id = t.agency_id AND r.status = 'planifie') AS pending,
       (SELECT COUNT(*) FROM wa_trigger_runs r WHERE r.trigger_id = t.id AND r.agency_id = t.agency_id
          AND r.status = 'echec' AND r.created_at > UTC_TIMESTAMP() - INTERVAL 30 DAY) AS failed_30d
     FROM wa_triggers t WHERE t.agency_id = ? ORDER BY t.family, t.name`,
    [agencyId]
  );
  return rows.map(normalize);
}

export async function getTrigger(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [row] = await query(`SELECT * FROM wa_triggers WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  if (!row) {
    const err = new Error("Ressource introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
  return normalize(row);
}

function clean(data) {
  const err = (m) => Object.assign(new Error(m), { code: "VALIDATION" });
  const family = data.family;
  if (!FAMILIES[family]) throw err("Famille de déclencheur invalide.");
  const name = String(data.name || "").trim();
  if (!name) throw err("Le nom est obligatoire.");
  const out = {
    name: name.slice(0, 150),
    description: String(data.description || "").trim().slice(0, 500) || null,
    family,
    event_type: null,
    anchor: null,
    offset_days: null,
    inactivity_hours: null,
    audience: ["inscrits", "prospects", "equipe"].includes(data.audience) ? data.audience : "inscrits",
    conditions: JSON.stringify(data.conditions || {}),
    delay_minutes: Math.max(0, Number(data.delay_minutes ?? data.delayMinutes) || 0),
    template_name: String(data.template_name ?? data.templateName ?? "").trim() || null,
    free_text_when_open: data.free_text_when_open === false || data.freeTextWhenOpen === false ? 0 : 1,
    internal_action: null,
    internal_team: null,
    allowed_start: /^\d\d:\d\d/.test(data.allowed_start || data.allowedStart || "") ? data.allowed_start || data.allowedStart : "09:00",
    allowed_end: /^\d\d:\d\d/.test(data.allowed_end || data.allowedEnd || "") ? data.allowed_end || data.allowedEnd : "21:00",
    skip_friday_prayer: data.skip_friday_prayer === false || data.skipFridayPrayer === false ? 0 : 1,
    urgent: data.urgent ? 1 : 0,
    stop_conditions: JSON.stringify((data.stop_conditions || data.stopConditions || []).filter((s) => STOP_CONDITIONS[s])),
    max_per_target: Math.min(10, Math.max(1, Number(data.max_per_target ?? data.maxPerTarget) || 1)),
  };
  if (family === "evenement") {
    if (!EVENT_TYPES[data.event_type ?? data.eventType]) throw err("Choisir l'événement déclencheur.");
    out.event_type = data.event_type ?? data.eventType;
  }
  if (family === "date_relative") {
    const anchor = data.anchor;
    if (!["depart", "retour", "inscription"].includes(anchor)) throw err("Choisir la date de référence.");
    out.anchor = anchor;
    out.offset_days = Number(data.offset_days ?? data.offsetDays) || 0;
  }
  if (family === "inactivite") {
    const h = Number(data.inactivity_hours ?? data.inactivityHours);
    if (!Number.isInteger(h) || h < 1) throw err("Indiquer le délai d'inactivité en heures.");
    out.inactivity_hours = h;
  }
  if (family === "interne") {
    const action = data.internal_action ?? data.internalAction;
    if (!INTERNAL_ACTIONS[action]) throw err("Choisir l'action interne.");
    out.internal_action = action;
    out.internal_team = String(data.internal_team ?? data.internalTeam ?? "direction").trim() || "direction";
    out.event_type = action === "notifier_equipe" ? data.event_type ?? data.eventType ?? "prospect_qualifie" : null;
    out.audience = "equipe";
  } else if (!out.template_name) {
    throw err("Choisir le template à envoyer.");
  }
  return out;
}

export async function saveTrigger(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const fields = clean(data);
  const cols = Object.keys(fields);
  if (data.id) {
    await assertOwned("wa_triggers", data.id, agencyId);
    const setClause = cols.map((c) => c + " = ?").join(", ");
    await query(`UPDATE wa_triggers SET ${setClause} WHERE id = ? AND agency_id = ?`, [...cols.map((c) => fields[c]), data.id, agencyId]);
    return getTrigger(data.id, agencyId);
  }
  const result = await query(
    `INSERT INTO wa_triggers (agency_id, code, ${cols.join(", ")}) VALUES (?, ?, ${cols.map(() => "?").join(", ")})`,
    [agencyId, data.code || null, ...cols.map((c) => fields[c])]
  );
  return getTrigger(result.insertId, agencyId);
}

export async function setTriggerActive(id, active, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_triggers", id, agencyId);
  await query(`UPDATE wa_triggers SET is_active = ? WHERE id = ? AND agency_id = ?`, [active ? 1 : 0, id, agencyId]);
  // Désactiver annule les envois encore planifiés.
  if (!active) {
    await query(
      `UPDATE wa_trigger_runs SET status = 'annule', result = 'déclencheur désactivé', executed_at = UTC_TIMESTAMP()
       WHERE trigger_id = ? AND agency_id = ? AND status = 'planifie'`,
      [id, agencyId]
    );
  }
}

export async function deleteTrigger(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_triggers", id, agencyId);
  await query(`DELETE FROM wa_triggers WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

export async function listRuns({ triggerId = null, limit = 100 } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT r.*, t.name AS trigger_name, tr.full_name AS traveler_name, ct.profile_name, ct.phone
     FROM wa_trigger_runs r
     JOIN wa_triggers t ON t.id = r.trigger_id AND t.agency_id = r.agency_id
     LEFT JOIN registrations reg ON reg.id = r.registration_id AND reg.agency_id = r.agency_id
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id AND tr.agency_id = r.agency_id
     LEFT JOIN wa_contacts ct ON ct.id = r.contact_id AND ct.agency_id = r.agency_id
     WHERE r.agency_id = ? ${triggerId ? "AND r.trigger_id = ?" : ""}
     ORDER BY r.id DESC LIMIT ${Number(limit)}`,
    triggerId ? [agencyId, triggerId] : [agencyId]
  );
}

// --- Conditions (filtres) ------------------------------------------------------

// Inscription éligible aux conditions d'un déclencheur ?
async function registrationMatches(agencyId, registrationId, conditions) {
  const [r] = await query(
    `SELECT r.status, r.visa_status, r.total_due, r.group_id, rg.total_due AS group_total_due, p.family,
       tr.passport_number, tr.passport_expiry_date, t.departure_date
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id AND rg.agency_id = r.agency_id
     WHERE r.id = ? AND r.agency_id = ?`,
    [registrationId, agencyId]
  );
  if (!r || r.status === "annule") return false;
  const c = conditions || {};
  if (c.statuts?.length && !c.statuts.includes(r.status)) return false;
  if (c.visa?.length && !c.visa.includes(r.visa_status)) return false;
  if (c.famille && c.famille !== r.family) return false;
  if (c.documents_incomplets && r.passport_number && r.passport_expiry_date) return false;
  if (c.solde_positif) {
    const [paid] = r.group_id
      ? await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE group_id = ? AND agency_id = ?`, [r.group_id, agencyId])
      : await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE registration_id = ? AND agency_id = ?`, [registrationId, agencyId]);
    const due = Number(r.group_id ? r.group_total_due : r.total_due) || 0;
    if (due - Number(paid?.paid || 0) <= 0) return false;
  }
  return true;
}

async function contactMatches(agencyId, contactId, conditions) {
  const [ct] = await query(`SELECT stage, blocked FROM wa_contacts WHERE id = ? AND agency_id = ?`, [contactId, agencyId]);
  if (!ct || ct.blocked) return false;
  if (conditions?.etapes?.length && !conditions.etapes.includes(ct.stage)) return false;
  return true;
}

// Inscriptions visées par un événement (un paiement de groupe vise son responsable).
async function eventRegistrations(agencyId, event) {
  if (event.registrationId) return [Number(event.registrationId)];
  if (event.groupId) {
    const [g] = await query(
      `SELECT COALESCE(rg.responsible_registration_id,
         (SELECT MIN(r.id) FROM registrations r WHERE r.group_id = rg.id AND r.agency_id = rg.agency_id AND r.status <> 'annule')) AS rid
       FROM registration_groups rg WHERE rg.id = ? AND rg.agency_id = ?`,
      [event.groupId, agencyId]
    );
    return g?.rid ? [g.rid] : [];
  }
  if (event.tripId) {
    const rows = await query(`SELECT id FROM registrations WHERE trip_id = ? AND agency_id = ? AND status <> 'annule'`, [event.tripId, agencyId]);
    return rows.map((r) => r.id);
  }
  return [];
}

// --- Planification -------------------------------------------------------------

async function sentCount(agencyId, triggerId, { registrationId, contactId }) {
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM wa_trigger_runs WHERE agency_id = ? AND trigger_id = ? AND status IN ('envoye', 'planifie')
       AND ${registrationId ? "registration_id = ?" : "contact_id = ?"}`,
    [agencyId, triggerId, registrationId || contactId]
  );
  return Number(row.n);
}

// Crée une exécution planifiée (ignorée si la même clé existe déjà).
export async function scheduleRun(agencyId, trigger, { registrationId = null, contactId = null, dedupeKey, at = new Date() }) {
  if (trigger.family !== "interne" && (await sentCount(agencyId, trigger.id, { registrationId, contactId })) >= trigger.max_per_target) return null;
  const when = nextAllowedTime(trigger, new Date(at.getTime() + (trigger.delay_minutes || 0) * 60000));
  try {
    const result = await query(
      `INSERT INTO wa_trigger_runs (agency_id, trigger_id, registration_id, contact_id, dedupe_key, status, scheduled_at)
       VALUES (?, ?, ?, ?, ?, 'planifie', ?)`,
      [agencyId, trigger.id, registrationId, contactId, dedupeKey.slice(0, 190), toSql(when)]
    );
    return result.insertId;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return null;
    throw err;
  }
}

async function activeTriggers(agencyId, where, params = []) {
  const rows = await query(`SELECT * FROM wa_triggers WHERE agency_id = ? AND is_active = TRUE AND ${where}`, [agencyId, ...params]);
  return rows.map(normalize);
}

// Événement CRM reçu (worker, file wa-triggers).
export async function handleCrmEvent(agencyId, event) {
  const triggers = await activeTriggers(agencyId, "event_type = ? AND family IN ('evenement', 'interne')", [event.type]);
  let planned = 0;
  for (const trigger of triggers) {
    const eventKey = event.paymentId ? `p${event.paymentId}` : event.type;
    if (trigger.family === "interne") {
      const id = await scheduleRun(agencyId, trigger, {
        contactId: event.contactId || null,
        registrationId: event.registrationId || null,
        dedupeKey: `t${trigger.id}-${event.contactId ? `c${event.contactId}` : `r${event.registrationId}`}-${eventKey}`,
      });
      if (id) planned += 1;
      continue;
    }
    for (const registrationId of await eventRegistrations(agencyId, event)) {
      if (!(await registrationMatches(agencyId, registrationId, trigger.conditions))) continue;
      const id = await scheduleRun(agencyId, trigger, { registrationId, dedupeKey: `t${trigger.id}-r${registrationId}-${eventKey}` });
      if (id) planned += 1;
    }
  }
  return planned;
}

// Cibles d'un déclencheur à date relative / d'inactivité POUR AUJOURD'HUI
// (heure du Maroc). Partagé par la planification et le bouton « Simuler ».
async function dueTargets(agencyId, trigger) {
  const today = localParts().date;
  if (trigger.family === "date_relative") {
    const column = { depart: "t.departure_date", retour: "t.return_date", inscription: "DATE(r.registration_date)" }[trigger.anchor];
    const rows = await query(
      `SELECT r.id AS registration_id, tr.full_name, tr.phone_whatsapp
       FROM registrations r
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
       WHERE r.agency_id = ? AND r.status <> 'annule' AND ${column} = DATE_SUB(?, INTERVAL ? DAY)`,
      [agencyId, today, Number(trigger.offset_days) || 0]
    );
    const out = [];
    for (const r of rows) if (await registrationMatches(agencyId, r.registration_id, trigger.conditions)) out.push({ ...r, dedupe: `t${trigger.id}-r${r.registration_id}-${today}` });
    return out;
  }
  if (trigger.family === "inactivite") {
    // L'agence a parlé en dernier et le client n'a rien répondu depuis X heures.
    const rows = await query(
      `SELECT ct.id AS contact_id, ct.profile_name AS full_name, ct.phone AS phone_whatsapp, last_out.id AS last_out_id
       FROM wa_contacts ct
       JOIN wa_conversations c ON c.contact_id = ct.id AND c.agency_id = ct.agency_id AND c.status IN ('ia', 'copilote', 'attente')
       JOIN wa_messages last_out ON last_out.id = (
         SELECT MAX(m.id) FROM wa_messages m WHERE m.conversation_id = c.id AND m.agency_id = c.agency_id
           AND m.direction = 'sortant' AND m.is_private_note = FALSE AND (m.draft_status IS NULL OR m.draft_status = 'envoye'))
       WHERE ct.agency_id = ? AND ct.blocked = FALSE
         AND last_out.created_at < UTC_TIMESTAMP() - INTERVAL ? HOUR
         AND last_out.created_at > UTC_TIMESTAMP() - INTERVAL ? HOUR
         AND (ct.last_inbound_at IS NULL OR ct.last_inbound_at < last_out.created_at)
         ${trigger.audience === "prospects" ? "AND ct.stage IN ('prospect', 'qualifie')" : ""}`,
      [agencyId, Number(trigger.inactivity_hours), Number(trigger.inactivity_hours) + 72]
    );
    const out = [];
    for (const r of rows) if (await contactMatches(agencyId, r.contact_id, trigger.conditions)) out.push({ ...r, dedupe: `t${trigger.id}-c${r.contact_id}-m${r.last_out_id}` });
    return out;
  }
  return [];
}

// Planification périodique (worker, toutes les 15 min — DC-07).
export async function planScheduledTriggers(agencyId) {
  let planned = 0;
  const triggers = await activeTriggers(agencyId, "family IN ('date_relative', 'inactivite', 'interne')");
  for (const trigger of triggers) {
    if (trigger.family === "interne") {
      if (trigger.internal_action !== "rapport_quotidien") continue;
      const { date, minutes } = localParts();
      if (minutes < 19 * 60) continue; // rapport à 19h (heure du Maroc)
      if (await scheduleRun(agencyId, { ...trigger, urgent: true }, { dedupeKey: `t${trigger.id}-${date}` })) planned += 1;
      continue;
    }
    for (const target of await dueTargets(agencyId, trigger)) {
      const id = await scheduleRun(agencyId, trigger, {
        registrationId: target.registration_id || null,
        contactId: target.contact_id || null,
        dedupeKey: target.dedupe,
      });
      if (id) planned += 1;
    }
  }
  return planned;
}

// « Simuler » (8.12) : qui recevrait ce déclencheur aujourd'hui, sans rien envoyer.
export async function simulateTrigger(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const trigger = await getTrigger(id, agencyId);
  if (trigger.family === "date_relative" || trigger.family === "inactivite") {
    const targets = await dueTargets(agencyId, trigger);
    return { mode: "aujourdhui", targets: targets.map((t) => ({ name: t.full_name, phone: t.phone_whatsapp })) };
  }
  const runs = await query(
    `SELECT r.scheduled_at, tr.full_name, ct.profile_name FROM wa_trigger_runs r
     LEFT JOIN registrations reg ON reg.id = r.registration_id AND reg.agency_id = r.agency_id
     LEFT JOIN travelers tr ON tr.id = reg.traveler_id AND tr.agency_id = r.agency_id
     LEFT JOIN wa_contacts ct ON ct.id = r.contact_id AND ct.agency_id = r.agency_id
     WHERE r.trigger_id = ? AND r.agency_id = ? AND r.status = 'planifie'`,
    [id, agencyId]
  );
  return { mode: "planifies", targets: runs.map((r) => ({ name: r.full_name || r.profile_name, scheduledAt: r.scheduled_at })) };
}

// Déclencheur « manuel » : lancement pour tous les inscrits d'un voyage
// (ex. changement de vol, texte saisi au lancement).
export async function launchManualTrigger(id, { tripId, text = "" }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const trigger = await getTrigger(id, agencyId);
  await assertOwned("trips", tripId, agencyId);
  const regs = await query(`SELECT id FROM registrations WHERE trip_id = ? AND agency_id = ? AND status <> 'annule'`, [tripId, agencyId]);
  const stamp = Date.now();
  let planned = 0;
  for (const r of regs) {
    if (!(await registrationMatches(agencyId, r.id, trigger.conditions))) continue;
    const runId = await scheduleRun(agencyId, { ...trigger, max_per_target: 1000 }, { registrationId: r.id, dedupeKey: `t${trigger.id}-r${r.id}-m${stamp}` });
    if (runId) {
      planned += 1;
      if (text) await query(`UPDATE wa_trigger_runs SET result = ? WHERE id = ? AND agency_id = ?`, [`texte:${String(text).slice(0, 240)}`, runId, agencyId]);
    }
  }
  return planned;
}

// --- Exécution -------------------------------------------------------------------

async function finishRun(agencyId, runId, status, { channel = null, messageId = null, result = null } = {}) {
  await query(
    `UPDATE wa_trigger_runs SET status = ?, channel = ?, message_id = ?, result = ?, executed_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`,
    [status, channel, messageId, result ? String(result).slice(0, 255) : null, runId, agencyId]
  );
}

// Conditions d'arrêt (DC-05), évaluées juste avant l'envoi.
async function stopReason(agencyId, trigger, run, contactId) {
  for (const cond of trigger.stop_conditions || []) {
    if (cond === "reponse_client" && contactId) {
      const [m] = await query(
        `SELECT m.id FROM wa_messages m JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
         WHERE c.contact_id = ? AND m.agency_id = ? AND m.direction = 'entrant' AND m.created_at > ? LIMIT 1`,
        [contactId, agencyId, run.created_at]
      );
      if (m) return STOP_CONDITIONS.reponse_client;
    }
    if (cond === "document_recu" && contactId) {
      const [m] = await query(
        `SELECT md.id FROM wa_media md JOIN wa_messages m ON m.id = md.message_id AND m.agency_id = md.agency_id
         JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
         WHERE c.contact_id = ? AND md.agency_id = ? AND m.direction = 'entrant' AND m.created_at > ? LIMIT 1`,
        [contactId, agencyId, run.created_at]
      );
      if (m) return STOP_CONDITIONS.document_recu;
    }
    if (run.registration_id && (cond === "paiement_complet" || cond === "visa_accorde" || cond === "depart_passe")) {
      const [r] = await query(
        `SELECT r.status, r.visa_status, t.departure_date < CURDATE() AS gone FROM registrations r
         JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id WHERE r.id = ? AND r.agency_id = ?`,
        [run.registration_id, agencyId]
      );
      if (cond === "paiement_complet" && r?.status === "paye_complet") return STOP_CONDITIONS.paiement_complet;
      if (cond === "visa_accorde" && r?.visa_status === "accorde") return STOP_CONDITIONS.visa_accorde;
      if (cond === "depart_passe" && r?.gone) return STOP_CONDITIONS.depart_passe;
    }
  }
  return null;
}

// Contact WhatsApp d'une inscription (créé à partir du numéro du voyageur).
async function contactForRegistration(agencyId, registrationId) {
  const [r] = await query(
    `SELECT tr.id AS traveler_id, tr.full_name, tr.phone_whatsapp FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id WHERE r.id = ? AND r.agency_id = ?`,
    [registrationId, agencyId]
  );
  if (!r?.phone_whatsapp) return null;
  const waId = toWaId(r.phone_whatsapp);
  if (!waId) return null;
  const [existing] = await query(`SELECT * FROM wa_contacts WHERE agency_id = ? AND (phone = ? OR traveler_id = ?) ORDER BY phone = ? DESC LIMIT 1`, [
    agencyId,
    waId,
    r.traveler_id,
    waId,
  ]);
  if (existing) return existing;
  const result = await query(
    `INSERT INTO wa_contacts (agency_id, phone, profile_name, traveler_id, stage, source) VALUES (?, ?, ?, ?, 'inscrit', 'crm')`,
    [agencyId, waId, r.full_name, r.traveler_id]
  );
  const [created] = await query(`SELECT * FROM wa_contacts WHERE id = ? AND agency_id = ?`, [result.insertId, agencyId]);
  return created;
}

// Conversation ouverte du contact, ou nouvelle (statut IA : si le client
// répond, l'agent prend le relais).
export async function conversationFor(agencyId, contactId) {
  const [conv] = await query(
    `SELECT id FROM wa_conversations WHERE contact_id = ? AND agency_id = ? AND status <> 'resolu' ORDER BY id DESC LIMIT 1`,
    [contactId, agencyId]
  );
  if (conv) return conv.id;
  const result = await query(`INSERT INTO wa_conversations (agency_id, contact_id, status, welcomed) VALUES (?, ?, 'ia', TRUE)`, [agencyId, contactId]);
  return result.insertId;
}

async function marketingCapReached(agencyId, contactId) {
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM wa_messages m
     JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     JOIN wa_templates t ON t.id = m.template_id AND t.agency_id = m.agency_id
     WHERE c.contact_id = ? AND m.agency_id = ? AND t.category = 'MARKETING' AND m.status <> 'echec'
       AND m.created_at > UTC_TIMESTAMP() - INTERVAL 7 DAY`,
    [contactId, agencyId]
  );
  return Number(row.n) >= 1;
}

export async function executeRun(agencyId, runId) {
  const [run] = await query(`SELECT * FROM wa_trigger_runs WHERE id = ? AND agency_id = ? AND status = 'planifie'`, [runId, agencyId]);
  if (!run) return null;
  const [triggerRow] = await query(`SELECT * FROM wa_triggers WHERE id = ? AND agency_id = ?`, [run.trigger_id, agencyId]);
  const trigger = normalize(triggerRow);
  if (!trigger?.is_active) return finishRun(agencyId, runId, "annule", { result: "déclencheur désactivé" });

  // Hors plage d'envoi (règle modifiée entre-temps) : reporté (DC-06).
  if (!isAllowedTime(trigger)) {
    await query(`UPDATE wa_trigger_runs SET scheduled_at = ? WHERE id = ? AND agency_id = ?`, [toSql(nextAllowedTime(trigger)), runId, agencyId]);
    return "reporte";
  }

  if (trigger.family === "interne") {
    if (trigger.internal_action === "rapport_quotidien") {
      // Même rapport que celui de 19h (paramétrable, §8.2) ; jamais deux fois le même jour.
      const delivered = await deliverDailyReport(agencyId);
      return finishRun(agencyId, runId, "envoye", { channel: "interne", result: delivered.skipped || delivered.report.title });
    }
    const [ct] = run.contact_id ? await query(`SELECT profile_name, phone FROM wa_contacts WHERE id = ? AND agency_id = ?`, [run.contact_id, agencyId]) : [null];
    const [conv] = run.contact_id
      ? await query(`SELECT id FROM wa_conversations WHERE contact_id = ? AND agency_id = ? ORDER BY id DESC LIMIT 1`, [run.contact_id, agencyId])
      : [null];
    await notify(
      { team: trigger.internal_team || "ventes", kind: "declencheur", title: `${trigger.name}${ct ? ` : ${ct.profile_name || `+${ct.phone}`}` : ""}`, conversationId: conv?.id || null },
      agencyId
    );
    return finishRun(agencyId, runId, "envoye", { channel: "interne" });
  }

  const contact = run.contact_id
    ? (await query(`SELECT * FROM wa_contacts WHERE id = ? AND agency_id = ?`, [run.contact_id, agencyId]))[0]
    : await contactForRegistration(agencyId, run.registration_id);
  if (!contact) return finishRun(agencyId, runId, "ignore", { result: "aucun numéro WhatsApp" });
  if (contact.blocked) return finishRun(agencyId, runId, "ignore", { result: "contact bloqué" });
  if (!run.contact_id) await query(`UPDATE wa_trigger_runs SET contact_id = ? WHERE id = ? AND agency_id = ?`, [contact.id, runId, agencyId]);

  const stop = await stopReason(agencyId, trigger, run, contact.id);
  if (stop) return finishRun(agencyId, runId, "annule", { result: `arrêt : ${stop}` });

  const variant = await pickTemplateVariant(agencyId, trigger.template_name, contact.language, { approvedOnly: false });
  if (!variant) return finishRun(agencyId, runId, "echec", { result: `template « ${trigger.template_name} » introuvable` });
  const marketing = (variant.category || variant.category_requested) === "MARKETING";
  if (marketing && !contact.marketing_opt_in) return finishRun(agencyId, runId, "ignore", { result: "pas de consentement marketing" });
  if (marketing && (await marketingCapReached(agencyId, contact.id))) return finishRun(agencyId, runId, "ignore", { result: "plafond : 1 message marketing par semaine" });

  const conversationId = await conversationFor(agencyId, contact.id);
  const manualText = String(run.result || "").startsWith("texte:") ? String(run.result).slice(6) : "";
  const context = await buildCrmContext(agencyId, { registrationId: run.registration_id, contactId: contact.id, extra: manualText ? { "texte.libre": manualText } : {} });

  try {
    // DC-03 : fenêtre de 24h ouverte → texte libre (gratuit) plutôt qu'un template.
    if (trigger.free_text_when_open && (await isServiceWindowOpen(agencyId, conversationId))) {
      const rendered = renderTemplate(variant, context);
      const sent = await sendConversationText(agencyId, conversationId, rendered.text, { author: "systeme" });
      return finishRun(agencyId, runId, "envoye", { channel: "texte", messageId: sent.messageId });
    }
    const approved = await pickTemplateVariant(agencyId, trigger.template_name, contact.language);
    if (!approved) return finishRun(agencyId, runId, "echec", { result: `aucune version approuvée par Meta de « ${trigger.template_name} »` });
    const sent = await sendTemplateToConversationWithContext(agencyId, conversationId, approved, context, { author: "systeme" });
    return finishRun(agencyId, runId, "envoye", { channel: "template", messageId: sent.messageId });
  } catch (err) {
    return finishRun(agencyId, runId, "echec", { result: err.message });
  }
}

// Exécutions arrivées à échéance, toutes agences (worker, chaque minute).
export async function listDueRuns(limit = 200) {
  return query(
    `SELECT id, agency_id FROM wa_trigger_runs -- agency-lint-ok: balayage worker, agence portée par chaque ligne
     WHERE status = 'planifie' AND scheduled_at <= UTC_TIMESTAMP() ORDER BY scheduled_at ASC LIMIT ${Number(limit)}`
  );
}

export async function listAgenciesWithActiveTriggers() {
  return query(`SELECT DISTINCT agency_id FROM wa_triggers WHERE is_active = TRUE -- agency-lint-ok: liste des agences à planifier`);
}

// Charge les 27 déclencheurs proposés (lib/whatsapp/defaultTriggers.js),
// INACTIFS, sans toucher à ceux déjà présents (même code).
export async function seedDefaultTriggers(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const { DEFAULT_TRIGGERS } = await import("./defaultTriggers");
  let created = 0;
  for (const def of DEFAULT_TRIGGERS) {
    const [exists] = await query(`SELECT id FROM wa_triggers WHERE agency_id = ? AND code = ?`, [agencyId, def.code]);
    if (exists) continue;
    await saveTrigger(def, agencyId);
    created += 1;
  }
  return created;
}
