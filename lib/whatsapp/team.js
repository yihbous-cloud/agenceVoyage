import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";

// Organisation du traitement humain (migration 038) : horaires d'ouverture,
// délais par motif (SLA), équipes, accompagnateurs de permanence, tâches et
// notifications internes. Les "équipes" du cahier des charges sont les RÔLES
// existants (ventes, comptabilite, suivi, direction + rôles personnalisés).

export const AGENCY_TIMEZONE = "Africa/Casablanca";
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Date/heure locale du Maroc d'un instant (Intl gère l'heure d'été/Ramadan).
export function localParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: AGENCY_TIMEZONE,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    weekday: WEEKDAYS[parts.weekday],
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toMinutes = (time) => {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + (m || 0);
};

export async function getBusinessHours(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [hours, exceptions] = await Promise.all([
    query(`SELECT id, weekday, open_time, close_time FROM business_hours WHERE agency_id = ? ORDER BY weekday, open_time`, [agencyId]),
    query(
      `SELECT id, start_date, end_date, label, closed, open_time, close_time FROM business_hours_exceptions
       WHERE agency_id = ? AND end_date >= CURDATE() - INTERVAL 1 DAY ORDER BY start_date`,
      [agencyId]
    ),
  ]);
  return { hours, exceptions: exceptions.map((e) => ({ ...e, closed: Boolean(e.closed) })) };
}

// Plages ouvertes (en minutes locales) d'un jour donné, exceptions comprises.
function rangesForDay(schedule, weekday, date) {
  const exception = schedule.exceptions.find((e) => e.start_date <= date && e.end_date >= date);
  if (exception) {
    if (exception.closed || !exception.open_time || !exception.close_time) return [];
    return [[toMinutes(exception.open_time), toMinutes(exception.close_time)]];
  }
  return schedule.hours
    .filter((h) => Number(h.weekday) === weekday)
    .map((h) => [toMinutes(h.open_time), toMinutes(h.close_time)]);
}

export function isOpenAt(schedule, date = new Date()) {
  const { weekday, date: day, minutes } = localParts(date);
  return rangesForDay(schedule, weekday, day).some(([o, c]) => minutes >= o && minutes < c);
}

// Prochaine ouverture, en texte (« demain à 09:00 », « lundi 09:00 ») pour
// les messages hors horaires. Recherche sur 14 jours.
export function nextOpeningLabel(schedule, from = new Date(), locale = "fr") {
  const opening = nextOpening(schedule, from);
  if (!opening) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-FR", {
    timeZone: AGENCY_TIMEZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(opening);
}

export function nextOpening(schedule, from = new Date()) {
  for (let step = 0; step < 14 * 24 * 4; step += 1) {
    const candidate = new Date(from.getTime() + step * 15 * 60 * 1000);
    if (isOpenAt(schedule, candidate)) {
      // Ajuste à la minute exacte d'ouverture.
      for (let back = 0; back < 15; back += 1) {
        const earlier = new Date(candidate.getTime() - (back + 1) * 60 * 1000);
        if (!isOpenAt(schedule, earlier) || earlier < from) return new Date(candidate.getTime() - back * 60 * 1000);
      }
      return candidate;
    }
  }
  return null;
}

// Échéance SLA : `minutes` comptées en horaires d'ouverture (sauf règle 24h/24).
export function computeSlaDue(schedule, rule, from = new Date()) {
  if (!rule) return null;
  if (rule.around_the_clock) return new Date(from.getTime() + rule.minutes * 60 * 1000);
  let remaining = rule.minutes;
  let cursor = new Date(from.getTime());
  for (let guard = 0; guard < 60 * 24 * 21 && remaining > 0; guard += 1) {
    if (isOpenAt(schedule, cursor)) {
      remaining -= 1;
      cursor = new Date(cursor.getTime() + 60 * 1000);
    } else {
      const next = nextOpening(schedule, cursor);
      if (!next) break;
      cursor = next;
    }
  }
  return cursor;
}

export async function setBusinessHours(rows, exceptions, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const valid = (rows || []).filter(
    (r) => Number.isInteger(Number(r.weekday)) && Number(r.weekday) >= 0 && Number(r.weekday) <= 6 && /^\d\d:\d\d/.test(r.openTime) && /^\d\d:\d\d/.test(r.closeTime) && r.openTime < r.closeTime
  );
  await query(`DELETE FROM business_hours WHERE agency_id = ?`, [agencyId]);
  for (const r of valid) {
    await query(`INSERT INTO business_hours (agency_id, weekday, open_time, close_time) VALUES (?, ?, ?, ?)`, [
      agencyId,
      Number(r.weekday),
      r.openTime,
      r.closeTime,
    ]);
  }
  if (Array.isArray(exceptions)) {
    await query(`DELETE FROM business_hours_exceptions WHERE agency_id = ?`, [agencyId]);
    for (const e of exceptions) {
      if (!e.startDate || !e.endDate || !e.label?.trim() || e.startDate > e.endDate) continue;
      await query(
        `INSERT INTO business_hours_exceptions (agency_id, start_date, end_date, label, closed, open_time, close_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [agencyId, e.startDate, e.endDate, e.label.trim(), e.closed ? 1 : 0, e.closed ? null : e.openTime || null, e.closed ? null : e.closeTime || null]
      );
    }
  }
  return getBusinessHours(agencyId);
}

// --- SLA -------------------------------------------------------------------

export async function listSlaRules(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM sla_rules WHERE agency_id = ? ORDER BY minutes ASC, label ASC`, [agencyId]);
  return rows.map((r) => ({ ...r, around_the_clock: Boolean(r.around_the_clock) }));
}

export async function getSlaRule(reason, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT * FROM sla_rules WHERE agency_id = ? AND reason IN (?, 'demande_humain')
     ORDER BY reason = ? DESC LIMIT 1`,
    [agencyId, reason, reason]
  );
  return rows[0] ? { ...rows[0], around_the_clock: Boolean(rows[0].around_the_clock) } : null;
}

export async function updateSlaRule(id, data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("sla_rules", id, agencyId);
  const minutes = Number(data.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
    const err = new Error("Délai invalide (1 à 10080 minutes).");
    err.code = "VALIDATION";
    throw err;
  }
  await query(
    `UPDATE sla_rules SET team = ?, minutes = ?, priority = ?, around_the_clock = ? WHERE id = ? AND agency_id = ?`,
    [
      String(data.team || "direction").trim(),
      minutes,
      ["basse", "normale", "haute", "urgente"].includes(data.priority) ? data.priority : "normale",
      data.aroundTheClock ? 1 : 0,
      id,
      agencyId,
    ]
  );
}

// --- Équipes ---------------------------------------------------------------

// Membres actifs d'une équipe (= rôle). Équipe vide ou inconnue : direction.
export async function teamMembers(team, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT su.id, su.full_name, su.phone, r.name AS role FROM staff_users su
     JOIN roles r ON r.id = su.role_id AND r.agency_id = su.agency_id
     WHERE su.agency_id = ? AND su.is_active = TRUE AND r.name = ?`,
    [agencyId, team]
  );
  return rows;
}

export async function resolveTeam(team, explicitAgencyId) {
  const members = await teamMembers(team, explicitAgencyId);
  return members.length > 0 ? team : "direction";
}

export async function listTeams(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(`SELECT name FROM roles WHERE agency_id = ? ORDER BY name`, [agencyId]);
}

export async function listActiveStaff(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT su.id, su.full_name, r.name AS role FROM staff_users su
     JOIN roles r ON r.id = su.role_id AND r.agency_id = su.agency_id
     WHERE su.agency_id = ? AND su.is_active = TRUE ORDER BY su.full_name`,
    [agencyId]
  );
}

// --- Accompagnateurs -------------------------------------------------------

export async function listEscortsForUpcomingTrips(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const trips = await query(
    `SELECT t.id, t.reference_code, t.departure_date, t.return_date, p.title AS program_title
     FROM trips t JOIN programs p ON p.id = t.program_id AND p.agency_id = t.agency_id
     WHERE t.agency_id = ? AND t.return_date >= CURDATE() - INTERVAL 3 DAY AND t.status <> 'annule'
     ORDER BY t.departure_date ASC`,
    [agencyId]
  );
  const escorts = await query(
    `SELECT te.trip_id, te.staff_id, su.full_name FROM trip_escorts te
     JOIN staff_users su ON su.id = te.staff_id AND su.agency_id = te.agency_id
     WHERE te.agency_id = ?`,
    [agencyId]
  );
  return trips.map((t) => ({ ...t, escorts: escorts.filter((e) => e.trip_id === t.id) }));
}

export async function setTripEscorts(tripId, staffIds, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("trips", tripId, agencyId);
  const ids = [...new Set((staffIds || []).map(Number).filter(Boolean))];
  for (const id of ids) await assertOwned("staff_users", id, agencyId);
  await query(`DELETE FROM trip_escorts WHERE trip_id = ? AND agency_id = ?`, [tripId, agencyId]);
  for (const id of ids) {
    await query(`INSERT INTO trip_escorts (agency_id, trip_id, staff_id) VALUES (?, ?, ?)`, [agencyId, tripId, id]);
  }
}

// Accompagnateurs du (des) voyage(s) EN COURS d'un voyageur — urgence en voyage.
export async function escortsForTraveler(travelerId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  if (!travelerId) return [];
  return query(
    `SELECT DISTINCT su.id, su.full_name, su.phone, t.reference_code
     FROM registrations r
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     JOIN trip_escorts te ON te.trip_id = t.id AND te.agency_id = r.agency_id
     JOIN staff_users su ON su.id = te.staff_id AND su.agency_id = r.agency_id AND su.is_active = TRUE
     WHERE r.agency_id = ? AND r.traveler_id = ? AND r.status <> 'annule'
       AND CURDATE() BETWEEN t.departure_date - INTERVAL 1 DAY AND t.return_date + INTERVAL 1 DAY`,
    [agencyId, travelerId]
  );
}

// --- Notifications ---------------------------------------------------------

export async function notify({ staffId = null, team = null, kind, title, body = null, conversationId = null, taskId = null }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await query(
    `INSERT INTO staff_notifications (agency_id, staff_id, team, kind, title, body, conversation_id, task_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [agencyId, staffId, team, kind, String(title).slice(0, 255), body, conversationId, taskId]
  );
}

// Notifications visibles par un membre : les siennes + celles de son équipe
// (direction voit tout).
export async function listNotificationsForStaff(session, { unreadOnly = false, limit = 50 } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const scope = session.role === "direction" ? "" : "AND (n.staff_id = ? OR (n.staff_id IS NULL AND n.team = ?))";
  const params = [agencyId, ...(session.role === "direction" ? [] : [session.id, session.role])];
  return query(
    `SELECT n.* FROM staff_notifications n
     WHERE n.agency_id = ? ${scope} ${unreadOnly ? "AND n.read_at IS NULL" : ""}
     ORDER BY n.id DESC LIMIT ${Number(limit)}`,
    params
  );
}

export async function markNotificationsRead(session, ids, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const list = (ids || []).map(Number).filter(Boolean);
  if (list.length === 0) return;
  await query(
    `UPDATE staff_notifications SET read_at = UTC_TIMESTAMP()
     WHERE agency_id = ? AND read_at IS NULL AND id IN (${list.map(() => "?").join(", ")})`,
    [agencyId, ...list]
  );
}

// --- Tâches ----------------------------------------------------------------

export async function createTask(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const result = await query(
    `INSERT INTO staff_tasks (agency_id, type, team, assigned_staff_id, conversation_id, contact_id, registration_id,
       media_id, title, details, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agencyId,
      data.type,
      data.team || null,
      data.assignedStaffId || null,
      data.conversationId || null,
      data.contactId || null,
      data.registrationId || null,
      data.mediaId || null,
      String(data.title).slice(0, 255),
      data.details ? JSON.stringify(data.details) : null,
      data.dueAt || null,
    ]
  );
  return result.insertId;
}

export async function listTasks(session, { status = "ouverte" } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const scope =
    session.role === "direction" ? "" : "AND (t.assigned_staff_id = ? OR t.team = ? OR (t.team IS NULL AND t.assigned_staff_id IS NULL))";
  const params = [agencyId, status, ...(session.role === "direction" ? [] : [session.id, session.role])];
  return query(
    `SELECT t.*, ct.phone AS contact_phone, ct.profile_name AS contact_name, su.full_name AS assigned_name,
       done.full_name AS done_by_name
     FROM staff_tasks t
     LEFT JOIN wa_contacts ct ON ct.id = t.contact_id AND ct.agency_id = t.agency_id
     LEFT JOIN staff_users su ON su.id = t.assigned_staff_id AND su.agency_id = t.agency_id
     LEFT JOIN staff_users done ON done.id = t.done_by_staff_id AND done.agency_id = t.agency_id
     WHERE t.agency_id = ? AND t.status = ? ${scope}
     ORDER BY t.due_at IS NULL, t.due_at ASC, t.id DESC LIMIT 200`,
    params
  );
}

export async function setTaskStatus(id, status, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("staff_tasks", id, agencyId);
  if (!["ouverte", "faite", "annulee"].includes(status)) throw new Error("Statut invalide");
  await query(
    `UPDATE staff_tasks SET status = ?, done_by_staff_id = ?, done_at = ? WHERE id = ? AND agency_id = ?`,
    [status, status === "ouverte" ? null : staffId, status === "ouverte" ? null : new Date().toISOString().slice(0, 19).replace("T", " "), id, agencyId]
  );
}

// --- Réponses rapides ------------------------------------------------------

export async function listQuickReplies(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(`SELECT * FROM wa_quick_replies WHERE agency_id = ? ORDER BY sort_order, shortcut`, [agencyId]);
}

export async function setQuickReplies(rows, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const seen = new Set();
  const valid = (rows || [])
    .map((r, i) => ({
      shortcut: String(r.shortcut || "").trim().toLowerCase().replace(/\s+/g, "-"),
      textFr: String(r.textFr ?? r.text_fr ?? "").trim(),
      textAr: String(r.textAr ?? r.text_ar ?? "").trim(),
      sort: i,
    }))
    .filter((r) => r.shortcut && (r.textFr || r.textAr) && !seen.has(r.shortcut) && seen.add(r.shortcut));
  await query(`DELETE FROM wa_quick_replies WHERE agency_id = ?`, [agencyId]);
  for (const r of valid) {
    await query(
      `INSERT INTO wa_quick_replies (agency_id, shortcut, text_fr, text_ar, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [agencyId, r.shortcut, r.textFr || null, r.textAr || null, r.sort]
    );
  }
  return listQuickReplies(agencyId);
}
