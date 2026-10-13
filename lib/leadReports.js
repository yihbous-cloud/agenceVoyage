import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { LEAD_CHANNELS } from "./leadSource";

// Rapport « Sources des demandes » (/admin/referencement, référencement
// vague 1C — CLAUDE.md §3centseizequadragies) : demandes par canal sur une
// période, pour les inscriptions et les messages de contact, plus les
// contacts WhatsApp arrivés par un bouton du site (lien « SITE »).
// Les dates de la base sont en UTC ; une période de N jours glissants.
export const LEAD_REPORT_PERIODS = [30, 90, 365];

async function countByChannel(table, dateColumn, agencyId, days) {
  const rows = await query(
    `SELECT COALESCE(lead_source, 'non_renseignee') AS channel, COUNT(*) AS n
     FROM ${table}
     WHERE agency_id = ? AND ${dateColumn} >= UTC_TIMESTAMP() - INTERVAL ? DAY
     GROUP BY channel`,
    [agencyId, days]
  );
  return Object.fromEntries(rows.map((r) => [r.channel, Number(r.n)]));
}

export async function getLeadSourceReport(days, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [registrations, messages, whatsapp] = await Promise.all([
    countByChannel("registrations", "registration_date", agencyId, days),
    countByChannel("contact_messages", "created_at", agencyId, days),
    query(
      `SELECT COUNT(*) AS n FROM wa_contacts
       WHERE agency_id = ? AND source = 'lien:SITE' AND created_at >= UTC_TIMESTAMP() - INTERVAL ? DAY`,
      [agencyId, days]
    ),
  ]);
  const channels = [...LEAD_CHANNELS.map((c) => c.key), "non_renseignee"].map((key) => ({
    key,
    registrations: registrations[key] || 0,
    messages: messages[key] || 0,
  }));
  return {
    days,
    channels: channels.filter((c) => c.registrations || c.messages || c.key !== "non_renseignee"),
    whatsappFromSite: Number(whatsapp[0]?.n || 0),
  };
}

export async function getLeadSourceReports(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const reports = await Promise.all(LEAD_REPORT_PERIODS.map((days) => getLeadSourceReport(days, agencyId)));
  return Object.fromEntries(reports.map((r) => [r.days, r]));
}
