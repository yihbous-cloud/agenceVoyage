import { query } from "../db";
import { resolveAgencyId } from "../agencyContext";
import { AGENCY_TIMEZONE } from "./team";
import { getOpsSettings, REPORT_SECTIONS } from "./ops";
import { getActiveSettings } from "../ai/settings";

// Pilotage WhatsApp (cahier §8.1-8.3, CLAUDE.md §3centtroisquadragies) :
// tableau de bord, statistiques, coûts, rapport quotidien.
// Les dates de période sont des jours LOCAUX (heure du Maroc) ; la base est
// en UTC : conversion par le décalage du fuseau au début de la période.

// Décalage (heures) d'Africa/Casablanca à une date donnée (+1 hors Ramadan).
export function tzOffsetHours(date = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: AGENCY_TIMEZONE, timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d+)?(?::(\d+))?/.exec(part || "");
  return m && m[1] ? Number(m[1]) + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) / 60 : 0) : 0;
}

export function localToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AGENCY_TIMEZONE }).format(date);
}

const pad = (n) => String(n).padStart(2, "0");
function utcSql(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// { from, to } (jours locaux inclus) → bornes UTC [start, end[.
export function periodBounds({ from, to } = {}) {
  const today = localToday();
  const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
  const f = isDay(from) ? from : today;
  // Début seul = du début jusqu'à aujourd'hui ; rien = aujourd'hui.
  let t = isDay(to) ? to : isDay(from) ? today : f;
  if (t < f) t = f;
  const offset = tzOffsetHours(new Date(`${f}T12:00:00Z`));
  const start = new Date(Date.parse(`${f}T00:00:00Z`) - offset * 3600 * 1000);
  const end = new Date(Date.parse(`${t}T00:00:00Z`) + 24 * 3600 * 1000 - offset * 3600 * 1000);
  const days = Math.round((end - start) / 86400000);
  return { from: f, to: t, start: utcSql(start), end: utcSql(end), offset, days };
}

const num = (v) => Number(v || 0);

// Périmètre « É » (cahier §3) : sans accès à toutes les conversations, le
// tableau de bord se limite à son équipe et aux conversations qui lui sont
// assignées.
function scopeFilter(scope, session, alias = "c") {
  if (scope === "all") return { sql: "", params: [] };
  return { sql: ` AND (${alias}.assigned_staff_id = ? OR ${alias}.team = ?)`, params: [session.id, session.role] };
}

// --- Tableau de bord (§8.1) -----------------------------------------------------

export async function dashboardData({ scope = "all", session = null, period = {} } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const p = periodBounds(period);
  const s = scopeFilter(scope, session);

  const [counters] = await query(
    `SELECT
       (SELECT COUNT(*) FROM wa_conversations c WHERE c.agency_id = ? AND c.opened_at >= ? AND c.opened_at < ?${s.sql}) AS conversations,
       (SELECT COUNT(*) FROM wa_contacts WHERE agency_id = ? AND created_at >= ? AND created_at < ?) AS new_contacts,
       (SELECT COUNT(*) FROM wa_contacts WHERE agency_id = ? AND stage = 'qualifie' AND updated_at >= ? AND updated_at < ?) AS qualified,
       (SELECT COUNT(*) FROM wa_conversations c WHERE c.agency_id = ? AND c.status = 'humain' AND c.first_human_reply_at IS NULL${s.sql}) AS pending_transfers,
       (SELECT COUNT(DISTINCT g.id) FROM registrations g JOIN wa_contacts ct ON ct.traveler_id = g.traveler_id AND ct.agency_id = g.agency_id
          WHERE g.agency_id = ? AND g.registration_date >= ? AND g.registration_date < ? AND ct.created_at <= g.registration_date) AS registrations_whatsapp`,
    [agencyId, p.start, p.end, ...s.params, agencyId, p.start, p.end, agencyId, p.start, p.end, agencyId, ...s.params, agencyId, p.start, p.end]
  );

  const hourly = await query(
    `SELECT HOUR(DATE_ADD(m.created_at, INTERVAL ? HOUR)) AS h, COUNT(*) AS n
     FROM wa_messages m JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     WHERE m.agency_id = ? AND m.direction = 'entrant' AND m.created_at >= ? AND m.created_at < ?${s.sql}
     GROUP BY h ORDER BY h`,
    [p.offset, agencyId, p.start, p.end, ...s.params]
  );
  const dailyStart = periodBounds({ from: shiftDay(p.to, -13), to: p.to });
  const daily = await query(
    `SELECT DATE_FORMAT(DATE_ADD(m.created_at, INTERVAL ? HOUR), '%Y-%m-%d') AS d,
       SUM(m.direction = 'entrant') AS inbound, SUM(m.direction = 'sortant') AS outbound
     FROM wa_messages m JOIN wa_conversations c ON c.id = m.conversation_id AND c.agency_id = m.agency_id
     WHERE m.agency_id = ? AND m.created_at >= ? AND m.created_at < ? AND m.type <> 'note'${s.sql}
     GROUP BY d ORDER BY d`,
    [dailyStart.offset, agencyId, dailyStart.start, dailyStart.end, ...s.params]
  );

  // Taux de résolution IA : conversations où l'IA a répondu sans transfert.
  const [resolution] = await query(
    `SELECT COUNT(*) AS handled, SUM(c.transferred_at IS NULL) AS resolved
     FROM wa_conversations c
     WHERE c.agency_id = ? AND c.opened_at >= ? AND c.opened_at < ?${s.sql}
       AND EXISTS (SELECT 1 FROM ia_logs l WHERE l.conversation_id = c.id AND l.agency_id = c.agency_id AND l.context = 'conversation')`,
    [agencyId, p.start, p.end, ...s.params]
  );
  const [firstReply] = await query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, c.transferred_at, c.first_human_reply_at)) AS avg_seconds, COUNT(*) AS n
     FROM wa_conversations c
     WHERE c.agency_id = ? AND c.transferred_at >= ? AND c.transferred_at < ? AND c.first_human_reply_at IS NOT NULL${s.sql}`,
    [agencyId, p.start, p.end, ...s.params]
  );

  const advisors = await query(
    `SELECT su.id, su.full_name,
       COUNT(DISTINCT c.id) AS conversations,
       AVG(TIMESTAMPDIFF(SECOND, c.transferred_at, c.first_human_reply_at)) AS avg_reply_seconds,
       (SELECT COUNT(DISTINCT g.id) FROM registrations g JOIN wa_contacts ct ON ct.traveler_id = g.traveler_id AND ct.agency_id = g.agency_id
          JOIN wa_conversations c2 ON c2.contact_id = ct.id AND c2.agency_id = ct.agency_id
          WHERE c2.assigned_staff_id = su.id AND g.agency_id = su.agency_id AND g.registration_date >= ? AND g.registration_date < ?) AS conversions
     FROM wa_conversations c JOIN staff_users su ON su.id = c.assigned_staff_id AND su.agency_id = c.agency_id
     WHERE c.agency_id = ? AND c.transferred_at >= ? AND c.transferred_at < ?${s.sql}
     GROUP BY su.id, su.full_name ORDER BY conversations DESC LIMIT 20`,
    [p.start, p.end, agencyId, p.start, p.end, ...s.params]
  );

  return {
    period: p,
    counters: Object.fromEntries(Object.entries(counters).map(([k, v]) => [k, num(v)])),
    hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: num(hourly.find((r) => Number(r.h) === h)?.n) })),
    daily: Array.from({ length: 14 }, (_, i) => {
      const d = shiftDay(p.to, i - 13);
      const row = daily.find((r) => r.d === d);
      return { day: d, inbound: num(row?.inbound), outbound: num(row?.outbound) };
    }),
    aiResolutionRate: num(resolution.handled) ? num(resolution.resolved) / num(resolution.handled) : null,
    aiHandled: num(resolution.handled),
    avgFirstHumanReplySeconds: firstReply.avg_seconds == null ? null : Math.round(Number(firstReply.avg_seconds)),
    advisors: advisors.map((a) => ({ ...a, conversations: num(a.conversations), conversions: num(a.conversions), avg_reply_seconds: a.avg_reply_seconds == null ? null : Math.round(Number(a.avg_reply_seconds)) })),
    alerts: await dashboardAlerts(agencyId, scope, session),
  };
}

export function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Alertes en tête du tableau de bord (§8.1).
export async function dashboardAlerts(agencyId, scope = "all", session = null) {
  const s = scopeFilter(scope, session);
  const alerts = [];
  const [sla] = await query(
    `SELECT COUNT(*) AS n FROM wa_conversations c WHERE c.agency_id = ? AND c.status IN ('humain', 'attente')
       AND c.first_human_reply_at IS NULL AND c.sla_due_at < UTC_TIMESTAMP()${s.sql}`,
    [agencyId, ...s.params]
  );
  if (num(sla.n)) alerts.push({ level: "danger", kind: "sla", text: `${num(sla.n)} conversation(s) en dépassement de délai (SLA)`, href: "/admin/whatsapp/conversations" });
  const [urg] = await query(
    `SELECT COUNT(*) AS n FROM wa_conversations c WHERE c.agency_id = ? AND c.transfer_reason = 'urgence' AND c.status <> 'resolu'${s.sql}`,
    [agencyId, ...s.params]
  );
  if (num(urg.n)) alerts.push({ level: "danger", kind: "urgence", text: `${num(urg.n)} urgence(s) voyage ouverte(s)`, href: "/admin/whatsapp/conversations" });
  if (scope !== "all") return alerts;

  const [account] = await query(`SELECT quality_rating, last_webhook_at, status FROM wa_accounts WHERE agency_id = ?`, [agencyId]);
  if (account) {
    const q = String(account.quality_rating || "").toUpperCase();
    if (q === "RED" || q === "YELLOW" || q === "LOW" || q === "MEDIUM") {
      alerts.push({ level: q === "RED" || q === "LOW" ? "danger" : "warning", kind: "qualite", text: `Note de qualité du numéro : ${account.quality_rating}`, href: "/admin/whatsapp/parametres" });
    }
    if (account.status === "actif") {
      const age = account.last_webhook_at ? (Date.now() - Date.parse(`${account.last_webhook_at.replace(" ", "T")}Z`)) / 3600000 : null;
      if (age == null || age > 24) alerts.push({ level: "warning", kind: "webhook", text: age == null ? "Aucun webhook Meta reçu" : `Aucun webhook Meta reçu depuis ${Math.round(age)} h`, href: "/admin/whatsapp/parametres" });
    }
  }
  const [tpl] = await query(
    `SELECT SUM(status = 'REJECTED') AS rejected, SUM(category_requested IS NOT NULL AND category IS NOT NULL AND category <> category_requested) AS reclassified
     FROM wa_templates WHERE agency_id = ?`,
    [agencyId]
  );
  if (num(tpl.rejected)) alerts.push({ level: "warning", kind: "template", text: `${num(tpl.rejected)} template(s) refusé(s) par Meta`, href: "/admin/whatsapp/templates" });
  if (num(tpl.reclassified)) alerts.push({ level: "warning", kind: "template", text: `${num(tpl.reclassified)} template(s) reclassé(s) par Meta`, href: "/admin/whatsapp/templates" });

  const settings = await getActiveSettings(agencyId).catch(() => null);
  const ops = await getOpsSettings(agencyId);
  if (settings?.monthly_cost_cap_usd) {
    const [m] = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM ia_logs WHERE agency_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
      [agencyId]
    );
    const ratio = Number(m.cost) / Number(settings.monthly_cost_cap_usd);
    if (ratio * 100 >= ops.cost_alert_percent) {
      alerts.push({ level: ratio >= 1 ? "danger" : "warning", kind: "cout", text: `Coût Claude du mois : ${Math.round(ratio * 100)} % du plafond`, href: "/admin/whatsapp/couts" });
    }
  }
  const jobs = await query(`SELECT name, last_status, last_run_at, last_message FROM system_jobs`);
  for (const j of jobs) {
    if (j.last_status === "erreur") alerts.push({ level: "danger", kind: "systeme", text: `Tâche « ${j.name} » en échec : ${j.last_message || ""}`, href: "/admin/whatsapp/parametres" });
  }
  return alerts;
}

// --- Statistiques (§8.2) --------------------------------------------------------

export async function statisticsData(period = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const p = periodBounds(period);
  const funnelSql = (groupExpr, join = "") =>
    `SELECT ${groupExpr} AS label,
       COUNT(DISTINCT ct.id) AS contacts,
       COUNT(DISTINCT CASE WHEN ct.stage IN ('qualifie', 'inscrit', 'en_voyage', 'ancien') OR JSON_LENGTH(ct.qualification) > 0 THEN ct.id END) AS qualified,
       COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM wa_conversations c WHERE c.contact_id = ct.id AND c.agency_id = ct.agency_id AND c.transferred_at IS NOT NULL) THEN ct.id END) AS transferred,
       COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM registrations g WHERE g.traveler_id = ct.traveler_id AND g.agency_id = ct.agency_id
          AND g.registration_date >= ct.created_at AND g.status <> 'annule') THEN ct.id END) AS registered
     FROM wa_contacts ct ${join}
     WHERE ct.agency_id = ? AND ct.created_at >= ? AND ct.created_at < ?
     GROUP BY label ORDER BY contacts DESC LIMIT 30`;
  const bySource = await query(funnelSql("COALESCE(ct.source, 'direct')"), [agencyId, p.start, p.end]);
  const byProgram = await query(
    funnelSql(
      "COALESCE(p.title, JSON_UNQUOTE(JSON_EXTRACT(ct.qualification, '$.type_voyage')), 'non précisé')",
      `LEFT JOIN programs p ON p.agency_id = ct.agency_id AND p.slug = JSON_UNQUOTE(JSON_EXTRACT(ct.qualification, '$.programme_slug'))`
    ),
    [agencyId, p.start, p.end]
  );
  const reasons = await query(
    `SELECT COALESCE(transfer_reason, 'autre') AS reason, COUNT(*) AS n FROM wa_conversations
     WHERE agency_id = ? AND transferred_at >= ? AND transferred_at < ? GROUP BY reason ORDER BY n DESC`,
    [agencyId, p.start, p.end]
  );
  const unanswered = await query(
    `SELECT question, COUNT(*) AS n, MAX(created_at) AS last_at FROM ia_unanswered
     WHERE agency_id = ? AND created_at >= ? AND created_at < ? AND handled = FALSE
     GROUP BY question ORDER BY n DESC, last_at DESC LIMIT 20`,
    [agencyId, p.start, p.end]
  );
  // Questions fréquentes : outils les plus demandés à l'IA (proxy des sujets).
  const tools = await query(
    `SELECT jt.name, COUNT(*) AS n FROM ia_logs l,
       JSON_TABLE(l.tools, '$[*]' COLUMNS (name VARCHAR(60) PATH '$.name')) jt
     WHERE l.agency_id = ? AND l.created_at >= ? AND l.created_at < ? AND l.context = 'conversation'
     GROUP BY jt.name ORDER BY n DESC`,
    [agencyId, p.start, p.end]
  );
  const templates = await query(
    `SELECT t.name, COUNT(m.id) AS sent, SUM(m.status IN ('livre', 'lu')) AS delivered, SUM(m.status = 'lu') AS read_count,
       SUM(m.status = 'echec') AS failed,
       SUM(EXISTS (SELECT 1 FROM wa_messages i WHERE i.conversation_id = m.conversation_id AND i.agency_id = m.agency_id
         AND i.direction = 'entrant' AND i.created_at > m.created_at AND i.created_at < m.created_at + INTERVAL 3 DAY)) AS replies
     FROM wa_messages m JOIN wa_templates t ON t.id = m.template_id AND t.agency_id = m.agency_id
     WHERE m.agency_id = ? AND m.created_at >= ? AND m.created_at < ?
     GROUP BY t.name ORDER BY sent DESC LIMIT 50`,
    [agencyId, p.start, p.end]
  );
  const campaigns = await query(
    `SELECT cp.id, cp.name, cp.status, COUNT(r.id) AS sent,
       SUM(m.status IN ('livre', 'lu')) AS delivered, SUM(m.status = 'lu') AS read_count
     FROM wa_campaigns cp
     LEFT JOIN wa_campaign_recipients r ON r.campaign_id = cp.id AND r.agency_id = cp.agency_id AND r.status = 'envoye'
     LEFT JOIN wa_messages m ON m.id = r.message_id AND m.agency_id = r.agency_id
     WHERE cp.agency_id = ? AND cp.started_at >= ? AND cp.started_at < ?
     GROUP BY cp.id, cp.name, cp.status ORDER BY cp.id DESC`,
    [agencyId, p.start, p.end]
  );
  // Satisfaction après voyage : réponses au questionnaire (template gf_avis_satisfaction).
  const [satisfaction] = await query(
    `SELECT COUNT(m.id) AS sent,
       SUM(EXISTS (SELECT 1 FROM wa_messages i WHERE i.conversation_id = m.conversation_id AND i.agency_id = m.agency_id
         AND i.direction = 'entrant' AND i.created_at > m.created_at AND i.created_at < m.created_at + INTERVAL 7 DAY)) AS answered
     FROM wa_messages m JOIN wa_templates t ON t.id = m.template_id AND t.agency_id = m.agency_id
     WHERE m.agency_id = ? AND t.name = 'gf_avis_satisfaction' AND m.created_at >= ? AND m.created_at < ?`,
    [agencyId, p.start, p.end]
  );
  const numRows = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && k !== "label" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : v])));
  return {
    period: p,
    bySource: numRows(bySource),
    byProgram: numRows(byProgram),
    reasons: numRows(reasons),
    unanswered: numRows(unanswered),
    tools: numRows(tools),
    templates: numRows(templates),
    campaigns: numRows(campaigns),
    satisfaction: { sent: num(satisfaction.sent), answered: num(satisfaction.answered) },
  };
}

// --- Coûts (§8.3) ----------------------------------------------------------------

export async function costsData(period = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const p = periodBounds(period);
  const ops = await getOpsSettings(agencyId);
  const metaByCategory = await query(
    `SELECT COALESCE(LOWER(m.billed_category), IF(m.type = 'template', 'non communiqué', 'service')) AS category,
       COUNT(*) AS messages, COALESCE(SUM(m.cost_mad), 0) AS cost
     FROM wa_messages m WHERE m.agency_id = ? AND m.direction = 'sortant' AND m.type <> 'note' AND m.status <> 'echec'
       AND m.created_at >= ? AND m.created_at < ?
     GROUP BY category ORDER BY cost DESC`,
    [agencyId, p.start, p.end]
  );
  const metaByTemplate = await query(
    `SELECT t.name, COUNT(*) AS messages, COALESCE(SUM(m.cost_mad), 0) AS cost
     FROM wa_messages m JOIN wa_templates t ON t.id = m.template_id AND t.agency_id = m.agency_id
     WHERE m.agency_id = ? AND m.created_at >= ? AND m.created_at < ? AND m.status <> 'echec'
     GROUP BY t.name ORDER BY cost DESC, messages DESC LIMIT 50`,
    [agencyId, p.start, p.end]
  );
  const metaByCampaign = await query(
    `SELECT cp.id, cp.name, COUNT(m.id) AS messages, COALESCE(SUM(m.cost_mad), 0) AS cost
     FROM wa_messages m JOIN wa_campaigns cp ON cp.id = m.campaign_id AND cp.agency_id = m.agency_id
     WHERE m.agency_id = ? AND m.created_at >= ? AND m.created_at < ?
     GROUP BY cp.id, cp.name ORDER BY cost DESC`,
    [agencyId, p.start, p.end]
  );
  const [free] = await query(
    `SELECT COUNT(*) AS total, SUM(COALESCE(m.cost_mad, 0) = 0 AND m.type <> 'template') AS free_window,
       SUM(m.cost_mad = 0 AND m.type = 'template') AS free_templates
     FROM wa_messages m WHERE m.agency_id = ? AND m.direction = 'sortant' AND m.type <> 'note' AND m.status <> 'echec'
       AND m.created_at >= ? AND m.created_at < ?`,
    [agencyId, p.start, p.end]
  );
  const [fep] = await query(
    `SELECT COUNT(*) AS n FROM wa_conversations WHERE agency_id = ? AND fep_until IS NOT NULL AND opened_at >= ? AND opened_at < ?`,
    [agencyId, p.start, p.end]
  );
  const claudeByModel = await query(
    `SELECT model, context, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
       SUM(cache_read_tokens) AS cache_read_tokens, COALESCE(SUM(cost_usd), 0) AS cost_usd
     FROM ia_logs WHERE agency_id = ? AND created_at >= ? AND created_at < ? GROUP BY model, context ORDER BY cost_usd DESC`,
    [agencyId, p.start, p.end]
  );
  const claudeByDay = await query(
    `SELECT DATE_FORMAT(DATE_ADD(created_at, INTERVAL ? HOUR), '%Y-%m-%d') AS day, COALESCE(SUM(cost_usd), 0) AS cost_usd, COUNT(*) AS calls
     FROM ia_logs WHERE agency_id = ? AND created_at >= ? AND created_at < ? GROUP BY day ORDER BY day`,
    [p.offset, agencyId, p.start, p.end]
  );
  const claudeTopConversations = await query(
    `SELECT l.conversation_id, ct.profile_name, ct.phone, COUNT(*) AS calls, COALESCE(SUM(l.cost_usd), 0) AS cost_usd
     FROM ia_logs l JOIN wa_conversations c ON c.id = l.conversation_id AND c.agency_id = l.agency_id
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE l.agency_id = ? AND l.created_at >= ? AND l.created_at < ?
     GROUP BY l.conversation_id, ct.profile_name, ct.phone ORDER BY cost_usd DESC LIMIT 15`,
    [agencyId, p.start, p.end]
  );
  // Inscriptions générées via WhatsApp sur la période (rattachées au programme).
  const registrations = await query(
    `SELECT p.title AS program, COUNT(DISTINCT g.id) AS registrations
     FROM registrations g
     JOIN wa_contacts ct ON ct.traveler_id = g.traveler_id AND ct.agency_id = g.agency_id AND ct.created_at <= g.registration_date
     JOIN trips t ON t.id = g.trip_id AND t.agency_id = g.agency_id
     JOIN programs p ON p.id = t.program_id AND p.agency_id = g.agency_id
     WHERE g.agency_id = ? AND g.registration_date >= ? AND g.registration_date < ? AND g.status <> 'annule'
     GROUP BY p.title ORDER BY registrations DESC`,
    [agencyId, p.start, p.end]
  );
  const metaTotal = metaByCategory.reduce((s, r) => s + Number(r.cost), 0);
  const claudeUsd = claudeByModel.reduce((s, r) => s + Number(r.cost_usd), 0);
  const claudeMad = claudeUsd * ops.usd_to_mad;
  const totalMad = metaTotal + claudeMad;
  const regCount = registrations.reduce((s, r) => s + Number(r.registrations), 0);
  const settings = await getActiveSettings(agencyId).catch(() => null);
  const [month] = await query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM ia_logs WHERE agency_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    [agencyId]
  );
  const toNum = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ["cost", "cost_usd", "messages", "calls", "input_tokens", "output_tokens", "cache_read_tokens", "registrations"].includes(k) ? Number(v || 0) : v])));
  return {
    period: p,
    prices: { marketing: ops.price_marketing_mad, utility: ops.price_utility_mad, authentication: ops.price_authentication_mad, usdToMad: ops.usd_to_mad },
    meta: { total: metaTotal, byCategory: toNum(metaByCategory), byTemplate: toNum(metaByTemplate), byCampaign: toNum(metaByCampaign) },
    free: { total: num(free.total), freeWindow: num(free.free_window), freeTemplates: num(free.free_templates), adConversations: num(fep.n) },
    claude: { usd: claudeUsd, mad: claudeMad, byModel: toNum(claudeByModel), byDay: toNum(claudeByDay), topConversations: toNum(claudeTopConversations) },
    transcription: { usd: 0, note: "Aucun fournisseur de transcription configuré." },
    totalMad,
    registrations: toNum(registrations),
    costPerRegistration: regCount ? totalMad / regCount : null,
    cap: {
      monthlyCapUsd: settings?.monthly_cost_cap_usd ? Number(settings.monthly_cost_cap_usd) : null,
      monthCostUsd: Number(month.cost),
      alertPercent: ops.cost_alert_percent,
    },
  };
}

// --- Rapport quotidien (§8.2, DC-10) ---------------------------------------------

export async function buildDailyReport(explicitAgencyId, { day = null, sections = null } = {}) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const ops = await getOpsSettings(agencyId);
  const wanted = sections || ops.report_sections;
  const d = await dashboardData({ period: { from: day || localToday(), to: day || localToday() } }, agencyId);
  const c = await costsData({ from: d.period.from, to: d.period.to }, agencyId);
  const lines = [];
  const add = (section, label, value) => wanted.includes(section) && lines.push({ section, label, value });
  add("conversations", "Conversations ouvertes", d.counters.conversations);
  add("conversations", "Nouveaux contacts", d.counters.new_contacts);
  add("prospects", "Prospects qualifiés", d.counters.qualified);
  add("prospects", "Inscriptions via WhatsApp", d.counters.registrations_whatsapp);
  add("transferts", "Transferts en attente de réponse", d.counters.pending_transfers);
  add("transferts", "Délai moyen de première réponse (min)", d.avgFirstHumanReplySeconds == null ? "—" : Math.round(d.avgFirstHumanReplySeconds / 60));
  add("ia", "Taux de résolution par l'IA", d.aiResolutionRate == null ? "—" : `${Math.round(d.aiResolutionRate * 100)} %`);
  add("ia", "Coût Claude (USD)", c.claude.usd.toFixed(2));
  add("meta", "Messages envoyés", c.free.total);
  add("meta", "Coût Meta (MAD)", c.meta.total.toFixed(2));
  if (wanted.includes("campagnes")) {
    const [r] = await query(
      `SELECT COUNT(*) AS n FROM wa_campaign_recipients WHERE agency_id = ? AND status = 'envoye' AND sent_at >= ? AND sent_at < ?`,
      [agencyId, d.period.start, d.period.end]
    );
    add("campagnes", "Messages de campagne envoyés", num(r.n));
  }
  if (wanted.includes("urgences")) {
    const [u] = await query(`SELECT COUNT(*) AS n FROM wa_conversations WHERE agency_id = ? AND transfer_reason = 'urgence' AND status <> 'resolu'`, [agencyId]);
    add("urgences", "Urgences voyage ouvertes", num(u.n));
  }
  const alerts = d.alerts.map((a) => a.text);
  const title = `Rapport WhatsApp du ${d.period.from.split("-").reverse().join("/")}`;
  const text = [title, "", ...lines.map((l) => `- ${l.label} : ${l.value}`), ...(alerts.length ? ["", "Alertes :", ...alerts.map((a) => `- ${a}`)] : [])].join("\n");
  return { title, lines, alerts, text, sections: Object.fromEntries(wanted.map((k) => [k, REPORT_SECTIONS[k]])) };
}
