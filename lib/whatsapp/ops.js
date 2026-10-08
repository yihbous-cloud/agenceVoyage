import { query } from "../db";
import { resolveAgencyId } from "../agencyContext";

// Réglages d'exploitation d'une agence (CLAUDE.md §3centtroisquadragies) :
// tarifs Meta utilisés pour estimer/calculer les coûts, rapport quotidien,
// alertes, conservation des données (NF-13). Une ligne par agence, créée
// avec les valeurs par défaut à la première lecture.

export const REPORT_SECTIONS = {
  conversations: "Conversations et nouveaux contacts",
  prospects: "Prospects qualifiés et inscriptions",
  transferts: "Transferts en attente et SLA dépassés",
  ia: "Activité et coût de l'IA",
  meta: "Messages envoyés et coût Meta",
  campagnes: "Campagnes du jour",
  urgences: "Urgences voyage ouvertes",
};
export const DEFAULT_REPORT_SECTIONS = Object.keys(REPORT_SECTIONS);

const NUMERIC = [
  "price_marketing_mad",
  "price_utility_mad",
  "price_authentication_mad",
  "usd_to_mad",
  "report_hour",
  "cost_alert_percent",
  "retention_documents_days_after_trip",
  "retention_media_days",
  "retention_conversations_months",
  "retention_ia_logs_days",
];

function normalize(row) {
  if (!row) return null;
  const out = { ...row };
  for (const k of NUMERIC) out[k] = Number(row[k]);
  out.report_enabled = Boolean(row.report_enabled);
  out.purge_enabled = Boolean(row.purge_enabled);
  let sections = row.report_sections;
  if (typeof sections === "string") {
    try {
      sections = JSON.parse(sections);
    } catch {
      sections = null;
    }
  }
  out.report_sections = Array.isArray(sections) ? sections : DEFAULT_REPORT_SECTIONS;
  return out;
}

export async function getOpsSettings(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  let [row] = await query(`SELECT * FROM wa_ops_settings WHERE agency_id = ?`, [agencyId]);
  if (!row) {
    await query(`INSERT IGNORE INTO wa_ops_settings (agency_id) VALUES (?)`, [agencyId]);
    [row] = await query(`SELECT * FROM wa_ops_settings WHERE agency_id = ?`, [agencyId]);
  }
  return normalize(row);
}

const LIMITS = {
  price_marketing_mad: [0, 100],
  price_utility_mad: [0, 100],
  price_authentication_mad: [0, 100],
  usd_to_mad: [0.01, 100],
  report_hour: [0, 23],
  cost_alert_percent: [1, 100],
  retention_documents_days_after_trip: [1, 3650],
  retention_media_days: [7, 3650],
  retention_conversations_months: [1, 120],
  retention_ia_logs_days: [7, 3650],
};

function cleanEmails(value) {
  const list = String(value || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const bad = list.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (bad) throw Object.assign(new Error(`Adresse e-mail invalide : ${bad}`), { code: "VALIDATION" });
  return list.length ? list.join(", ").slice(0, 500) : null;
}

export async function saveOpsSettings(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const current = await getOpsSettings(agencyId);
  const next = { ...current };
  for (const [k, [min, max]] of Object.entries(LIMITS)) {
    if (data[k] === undefined || data[k] === "") continue;
    const v = Number(data[k]);
    if (!Number.isFinite(v) || v < min || v > max) {
      throw Object.assign(new Error(`Valeur hors limites pour « ${k} » (${min} à ${max}).`), { code: "VALIDATION" });
    }
    next[k] = v;
  }
  if (data.report_enabled !== undefined) next.report_enabled = Boolean(data.report_enabled);
  if (data.purge_enabled !== undefined) next.purge_enabled = Boolean(data.purge_enabled);
  if (data.report_emails !== undefined) next.report_emails = cleanEmails(data.report_emails);
  if (data.alert_emails !== undefined) next.alert_emails = cleanEmails(data.alert_emails);
  if (Array.isArray(data.report_sections)) next.report_sections = data.report_sections.filter((s) => REPORT_SECTIONS[s]);
  await query(
    `UPDATE wa_ops_settings SET price_marketing_mad = ?, price_utility_mad = ?, price_authentication_mad = ?, usd_to_mad = ?,
       report_enabled = ?, report_hour = ?, report_sections = ?, report_emails = ?, alert_emails = ?, cost_alert_percent = ?,
       retention_documents_days_after_trip = ?, retention_media_days = ?, retention_conversations_months = ?,
       retention_ia_logs_days = ?, purge_enabled = ?
     WHERE agency_id = ?`,
    [
      next.price_marketing_mad,
      next.price_utility_mad,
      next.price_authentication_mad,
      next.usd_to_mad,
      next.report_enabled ? 1 : 0,
      next.report_hour,
      JSON.stringify(next.report_sections),
      next.report_emails,
      next.alert_emails,
      next.cost_alert_percent,
      next.retention_documents_days_after_trip,
      next.retention_media_days,
      next.retention_conversations_months,
      next.retention_ia_logs_days,
      next.purge_enabled ? 1 : 0,
      agencyId,
    ]
  );
  return { before: current, after: await getOpsSettings(agencyId) };
}

// Prix d'un message facturé par Meta (tarification par message). Les
// catégories gratuites (service, fenêtre 72h des pubs) valent 0.
export function priceForCategory(settings, category) {
  const c = String(category || "").toLowerCase();
  if (c === "marketing" || c === "marketing_lite") return settings.price_marketing_mad;
  if (c === "utility") return settings.price_utility_mad;
  if (c.startsWith("authentication")) return settings.price_authentication_mad;
  return 0;
}
