// Garde-fou multi-agences (CLAUDE.md §3sexvicies, passe 2) : repère les
// requêtes SQL qui touchent une table métier (porteuse d'agency_id) SANS
// mentionner agency_id — le risque n°1 de fuite entre agences est un filtre
// oublié. Usage : node scripts/agency-lint.mjs   (code de sortie 1 si alerte)
//
// Heuristique volontairement simple : chaque littéral de gabarit (`...`)
// contenant du SQL et une table métier doit contenir "agency_id". Une requête
// légitimement sans filtre (ex. lecture de la table globale `permissions`)
// n'est pas concernée car cette table n'est pas dans la liste ; une exception
// justifiée se marque avec le commentaire SQL `-- agency-lint-ok: raison`.
import fs from "node:fs";
import path from "node:path";

const TENANT_TABLES = [
  "agency_social_links", "airlines", "contact_messages", "flight_booking_passengers",
  "flight_bookings", "hotels", "news_posts", "payments", "program_faqs", "program_hotels",
  "programs", "registration_groups", "registration_hotel_preferences",
  "registration_room_assignments", "registrations", "roles", "rooms", "slides", "staff_users",
  "traveler_phone_numbers", "travelers", "trip_hotel_tier_prices", "trip_hotel_tiers",
  "trip_hotels", "trip_meal_offers", "trips", "visa_service_documents", "visa_service_requests",
  "visa_type_documents", "visa_types", "whatsapp_messages_log", "whatsapp_qa_templates",
  "whatsapp_reminders", "services", "trip_expenses", "trip_expense_installments", "ticket_sales",
  "wa_accounts", "wa_contacts", "wa_conversations", "wa_messages", "wa_media", "wa_consents", "audit_log",
  "ia_settings", "ia_knowledge", "ia_unanswered", "ia_logs", "ia_test_cases", "ia_test_runs", "business_hours", "business_hours_exceptions", "sla_rules", "trip_escorts", "staff_tasks", "staff_notifications", "wa_quick_replies", "wa_templates",
  "wa_triggers", "wa_trigger_runs", "wa_links", "payment_gateways", "payment_links",
  "wa_segments", "wa_campaigns", "wa_campaign_recipients", "wa_ops_settings", "ia_audits", "ia_audit_items",
];

const TABLE_RE = new RegExp(
  `\\b(?:FROM|JOIN|INTO|UPDATE)\\s+(${TENANT_TABLES.join("|")})\\b`,
  "gi"
);
const SQL_RE = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "i18n"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|mjs|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const roots = ["lib", "app", "proxy.js"];
const files = roots.flatMap((r) => (fs.statSync(r).isDirectory() ? walk(r) : [r]));

let alerts = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const re = /`([^`]*)`/gs;
  let m;
  while ((m = re.exec(src))) {
    const sql = m[1];
    if (!SQL_RE.test(sql)) continue;
    const tables = [...sql.matchAll(TABLE_RE)].map((t) => t[1].toLowerCase());
    if (tables.length === 0) continue;
    if (/agency_id|agency-lint-ok/.test(sql)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    alerts += 1;
    console.log(`${file}:${line}  tables: ${[...new Set(tables)].join(", ")}`);
  }
}

if (alerts > 0) {
  console.log(`\n${alerts} requête(s) sur une table métier sans agency_id.`);
  process.exit(1);
}
console.log("OK : toute requête sur une table métier mentionne agency_id.");
