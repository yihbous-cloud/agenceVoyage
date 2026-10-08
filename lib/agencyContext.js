import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { query } from "./db";

// Multi-agences (CLAUDE.md §3sexvicies, passe 2) : chaque requête métier doit
// être filtrée par l'agence courante. Cette fonction est l'unique source de
// vérité de "quelle agence ?" pour lib/*.js :
//
//   1. un `agencyId` explicite (pages publiques statiques/ISR : l'agence vient
//      du segment d'URL [agency], jamais d'un en-tête — lire headers() les
//      rendrait dynamiques) ;
//   2. sinon l'en-tête interne `x-agency-id` posé (et toujours écrasé) par
//      proxy.js — admin et routes API, toujours dans une requête ;
//   3. sinon l'agence de la TÂCHE en cours (runWithAgency) — worker WhatsApp,
//      qui traite plusieurs agences en parallèle dans un même processus :
//      un contexte par tâche (AsyncLocalStorage), jamais une variable globale ;
//   4. sinon, hors requête (scripts, tests), l'agence fixée explicitement via
//      setScriptAgencyId().
//
// ⚠️ Pas de repli silencieux sur l'agence 1 : sans agence identifiable on
// lève une erreur (fail closed) plutôt que de risquer de lire/écrire dans
// les données d'une autre agence.
let scriptAgencyId = null;
const agencyStorage = new AsyncLocalStorage();

// Exécute fn() avec une agence courante propre à cet appel (et à tout ce qu'il
// attend), sans effet sur les autres tâches qui tournent en parallèle.
export function runWithAgency(agencyId, fn) {
  const id = Number(agencyId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("agencyId invalide");
  return agencyStorage.run(id, fn);
}

export function setScriptAgencyId(id) {
  scriptAgencyId = id == null ? null : Number(id);
}

export async function resolveAgencyId(explicit) {
  if (explicit != null) {
    const id = Number(explicit);
    if (!Number.isInteger(id) || id <= 0) throw new Error("agencyId invalide");
    return id;
  }
  const taskAgencyId = agencyStorage.getStore();
  if (taskAgencyId) return taskAgencyId;
  try {
    const headerStore = await headers();
    const id = Number(headerStore.get("x-agency-id"));
    if (id) return id;
  } catch {
    // Hors portée de requête (script, build) : on retombe sur scriptAgencyId.
  }
  if (scriptAgencyId) return scriptAgencyId;
  throw new Error(
    "Agence courante introuvable (en-tête x-agency-id absent et aucun agencyId explicite)."
  );
}

// Tables métier dont les lignes appartiennent à une agence (colonne agency_id).
const TENANT_TABLES = new Set([
  "programs", "trips", "hotels", "airlines", "trip_hotels", "rooms", "travelers",
  "registrations", "registration_groups", "visa_types", "visa_service_requests",
  "trip_hotel_tiers", "roles", "staff_users", "slides", "news_posts", "payments",
  "flight_bookings", "program_faqs", "trip_meal_offers", "contact_messages", "services",
  "visa_service_documents", "trip_expenses", "trip_expense_installments", "ticket_sales",
  // WhatsApp (migration 037)
  "wa_accounts", "wa_contacts", "wa_conversations", "wa_messages", "wa_media", "wa_consents", "audit_log",
  // WhatsApp Lot 1 (migration 038)
  "ia_settings", "ia_knowledge", "ia_unanswered", "ia_logs", "ia_test_cases", "ia_test_runs", "business_hours", "business_hours_exceptions", "sla_rules", "trip_escorts", "staff_tasks", "staff_notifications", "wa_quick_replies", "wa_templates",
  "wa_triggers", "wa_trigger_runs", "wa_links", "payment_gateways", "payment_links",
  "wa_segments", "wa_campaigns", "wa_campaign_recipients", "wa_ops_settings", "ia_audits", "ia_audit_items",
]);

// Vérifie que la ligne `id` de `table` appartient bien à l'agence courante.
// À appeler AVANT tout INSERT/UPDATE qui référence un identifiant venu du
// client (tripId, hotelId, roomId...) : une clé étrangère valide en base ne
// prouve pas que la ressource est à nous. `connection` optionnel (même
// transaction que l'appelant). Lève une erreur "introuvable" sinon — jamais
// de message qui révélerait l'existence d'une ressource d'une autre agence.
export async function assertOwned(table, id, agencyId, connection) {
  if (!TENANT_TABLES.has(table)) throw new Error(`Table non gérée : ${table}`);
  if (id == null || id === "") throw new Error("Identifiant manquant");
  const sql = `SELECT id FROM ${table} WHERE id = ? AND agency_id = ? LIMIT 1`;
  const rows = connection
    ? (await connection.execute(sql, [id, agencyId]))[0]
    : await query(sql, [id, agencyId]);
  if (!rows[0]) {
    const err = new Error("Ressource introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
}

export async function assertAllOwned(table, ids, agencyId, connection) {
  for (const id of ids) await assertOwned(table, id, agencyId, connection);
}
