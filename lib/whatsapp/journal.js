import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { periodBounds, shiftDay, localToday } from "./analytics";
import { notify } from "./team";

// Journal et logs IA (cahier §8.16, NF-15, NF-17) : journal d'audit des
// actions des utilisateurs, journaux de l'agent IA, audit qualité
// hebdomadaire de 20 conversations IA tirées au hasard.

export const AUDIT_SAMPLE_SIZE = 20;

export async function listAuditLog(filters = {}, { limit = 100, offset = 0 } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const p = periodBounds({ from: filters.from || shiftDay(localToday(), -29), to: filters.to });
  const w = ["a.agency_id = ?", "a.created_at >= ?", "a.created_at < ?"];
  const params = [agencyId, p.start, p.end];
  if (filters.staff) {
    w.push("a.staff_id = ?");
    params.push(Number(filters.staff));
  }
  if (filters.action) {
    w.push("a.action LIKE ?");
    params.push(`${filters.action}%`);
  }
  const [count] = await query(`SELECT COUNT(*) AS n FROM audit_log a WHERE ${w.join(" AND ")} -- agency-lint-ok: agency_id imposé par le constructeur de filtres`, params);
  const rows = await query(
    `SELECT a.id, a.created_at, a.action, a.object_type, a.object_id, a.before_json, a.after_json, a.ip, su.full_name AS staff_name
     FROM audit_log a LEFT JOIN staff_users su ON su.id = a.staff_id AND su.agency_id = a.agency_id
     WHERE ${w.join(" AND ")} ORDER BY a.id DESC LIMIT ${Math.min(5000, Number(limit) || 100)} OFFSET ${Math.max(0, Number(offset) || 0)}`,
    params
  );
  const actions = await query(`SELECT DISTINCT action FROM audit_log WHERE agency_id = ? ORDER BY action`, [agencyId]);
  return { period: p, total: Number(count.n), rows, actions: actions.map((a) => a.action) };
}

export async function listIaLogs(filters = {}, { limit = 100, offset = 0 } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const p = periodBounds({ from: filters.from || shiftDay(localToday(), -6), to: filters.to });
  const w = ["l.agency_id = ?", "l.created_at >= ?", "l.created_at < ?"];
  const params = [agencyId, p.start, p.end];
  if (filters.outcome) {
    w.push("l.outcome = ?");
    params.push(filters.outcome);
  }
  if (filters.context) {
    w.push("l.context = ?");
    params.push(filters.context);
  }
  if (filters.evaluation === "a_corriger") w.push("l.evaluation = 'a_corriger'");
  if (filters.conversation) {
    w.push("l.conversation_id = ?");
    params.push(Number(filters.conversation));
  }
  const [count] = await query(`SELECT COUNT(*) AS n, COALESCE(SUM(l.cost_usd), 0) AS cost FROM ia_logs l WHERE ${w.join(" AND ")} -- agency-lint-ok: agency_id imposé par le constructeur de filtres`, params);
  const rows = await query(
    `SELECT l.id, l.created_at, l.conversation_id, l.context, l.model, l.input_tokens, l.output_tokens, l.cache_read_tokens,
       l.tool_rounds, l.tools, l.duration_ms, l.cost_usd, l.outcome, l.response, l.error, l.evaluation, l.settings_version
     FROM ia_logs l WHERE ${w.join(" AND ")} ORDER BY l.id DESC LIMIT ${Math.min(5000, Number(limit) || 100)} OFFSET ${Math.max(0, Number(offset) || 0)} -- agency-lint-ok: agency_id imposé par le constructeur de filtres`,
    params
  );
  const outcomes = await query(`SELECT DISTINCT outcome FROM ia_logs WHERE agency_id = ? ORDER BY outcome`, [agencyId]);
  return { period: p, total: Number(count.n), cost: Number(count.cost), rows, outcomes: outcomes.map((o) => o.outcome) };
}

// --- Audit qualité hebdomadaire ------------------------------------------------------

export async function createWeeklyAudit(staffId, explicitAgencyId, { periodEnd = null } = {}) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  // Tirage manuel : les 7 derniers jours, aujourd'hui compris ; l'audit
  // automatique du lundi passe explicitement la semaine écoulée.
  const end = periodEnd || localToday();
  const start = shiftDay(end, -6);
  const p = periodBounds({ from: start, to: end });
  const conversations = await query(
    `SELECT DISTINCT l.conversation_id AS id FROM ia_logs l
     JOIN wa_conversations c ON c.id = l.conversation_id AND c.agency_id = l.agency_id
     WHERE l.agency_id = ? AND l.context = 'conversation' AND l.created_at >= ? AND l.created_at < ?`,
    [agencyId, p.start, p.end]
  );
  if (!conversations.length) throw Object.assign(new Error("Aucune conversation traitée par l'IA sur cette période."), { code: "VALIDATION" });
  // Tirage aléatoire (Fisher-Yates) des 20 conversations.
  const ids = conversations.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const sample = ids.slice(0, AUDIT_SAMPLE_SIZE);
  const r = await query(`INSERT INTO ia_audits (agency_id, period_start, period_end, created_by_staff_id) VALUES (?, ?, ?, ?)`, [agencyId, start, end, staffId || null]);
  await query(
    `INSERT INTO ia_audit_items (agency_id, audit_id, conversation_id) VALUES ${sample.map(() => "(?, ?, ?)").join(", ")}`,
    sample.flatMap((id) => [agencyId, r.insertId, id])
  );
  return r.insertId;
}

export async function listAudits(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT a.*, su.full_name AS created_by_name,
       (SELECT COUNT(*) FROM ia_audit_items i WHERE i.audit_id = a.id AND i.agency_id = a.agency_id) AS items,
       (SELECT COUNT(*) FROM ia_audit_items i WHERE i.audit_id = a.id AND i.agency_id = a.agency_id AND i.reviewed_at IS NOT NULL) AS reviewed,
       (SELECT AVG(i.accuracy) FROM ia_audit_items i WHERE i.audit_id = a.id AND i.agency_id = a.agency_id) AS avg_accuracy,
       (SELECT AVG(i.tone) FROM ia_audit_items i WHERE i.audit_id = a.id AND i.agency_id = a.agency_id) AS avg_tone,
       (SELECT SUM(i.invented_info) FROM ia_audit_items i WHERE i.audit_id = a.id AND i.agency_id = a.agency_id) AS invented
     FROM ia_audits a LEFT JOIN staff_users su ON su.id = a.created_by_staff_id AND su.agency_id = a.agency_id
     WHERE a.agency_id = ? ORDER BY a.id DESC LIMIT 52`,
    [agencyId]
  );
}

export async function getAudit(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_audits", id, agencyId);
  const [audit] = await query(`SELECT * FROM ia_audits WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  const items = await query(
    `SELECT i.*, ct.profile_name, ct.phone, c.status AS conversation_status, c.transfer_reason, su.full_name AS reviewer_name,
       (SELECT COUNT(*) FROM ia_logs l WHERE l.conversation_id = i.conversation_id AND l.agency_id = i.agency_id) AS ai_turns
     FROM ia_audit_items i
     LEFT JOIN wa_conversations c ON c.id = i.conversation_id AND c.agency_id = i.agency_id
     LEFT JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     LEFT JOIN staff_users su ON su.id = i.reviewed_by_staff_id AND su.agency_id = i.agency_id
     WHERE i.audit_id = ? AND i.agency_id = ? ORDER BY i.id`,
    [id, agencyId]
  );
  return { audit, items };
}

const score = (v) => (v === "" || v == null ? null : Math.min(5, Math.max(1, Math.round(Number(v)))));
const bool = (v) => (v === "" || v == null ? null : v === true || v === "true" || v === 1 || v === "1");

export async function reviewAuditItem(itemId, data, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_audit_items", itemId, agencyId);
  const accuracy = score(data.accuracy);
  const tone = score(data.tone);
  if (accuracy == null || tone == null) throw Object.assign(new Error("Noter l'exactitude et le ton (1 à 5)."), { code: "VALIDATION" });
  await query(
    `UPDATE ia_audit_items SET accuracy = ?, tone = ?, transfer_ok = ?, invented_info = ?, comment = ?, reviewed_by_staff_id = ?, reviewed_at = UTC_TIMESTAMP()
     WHERE id = ? AND agency_id = ?`,
    [accuracy, tone, bool(data.transfer_ok), bool(data.invented_info) ? 1 : 0, String(data.comment || "").slice(0, 1000) || null, staffId || null, itemId, agencyId]
  );
  const [item] = await query(`SELECT audit_id FROM ia_audit_items WHERE id = ? AND agency_id = ?`, [itemId, agencyId]);
  const [left] = await query(`SELECT COUNT(*) AS n FROM ia_audit_items WHERE audit_id = ? AND agency_id = ? AND reviewed_at IS NULL`, [item.audit_id, agencyId]);
  if (!Number(left.n)) {
    await query(`UPDATE ia_audits SET status = 'termine', completed_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ? AND status = 'en_cours'`, [item.audit_id, agencyId]);
  }
  // Tolérance zéro (NF-15) : une information inventée alerte la direction.
  if (bool(data.invented_info)) {
    await notify({ team: "direction", kind: "audit_ia", title: "Audit IA : information inventée signalée — vérifier le prompt et la base de connaissances" }, agencyId);
  }
}

// Création automatique chaque lundi (worker) si l'audit de la semaine passée manque.
export async function ensureWeeklyAudit(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const end = shiftDay(localToday(), -1);
  const [exists] = await query(`SELECT id FROM ia_audits WHERE agency_id = ? AND period_end >= ?`, [agencyId, shiftDay(end, -6)]);
  if (exists) return null;
  try {
    const id = await createWeeklyAudit(null, agencyId, { periodEnd: end });
    await notify({ team: "direction", kind: "audit_ia", title: `Audit qualité IA de la semaine à réaliser (${AUDIT_SAMPLE_SIZE} conversations)` }, agencyId);
    return id;
  } catch (err) {
    if (err.code === "VALIDATION") return null; // aucune conversation IA cette semaine
    throw err;
  }
}
