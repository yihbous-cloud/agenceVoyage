import crypto from "node:crypto";
import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { getActiveSettings, getSettingsVersion } from "./settings";
import { runAgent } from "./agent";
import { buildStablePrompt, buildDynamicContext } from "./context";
import { transferMessageFor } from "../whatsapp/handoff";

// Bac à sable de l'agent (exigence 8.10) : discuter avec l'agent comme un
// client, sans RIEN envoyer sur WhatsApp ni modifier le CRM — les outils à
// effet de bord (transfert, tâches, brochure) sont simulés et affichés.
// Jeu de tests rejouable (NF-15) : exécuté par le worker (file wa-ai), les
// résultats sont comparés au passage précédent.

async function simulatedContact(agencyId, travelerId) {
  if (!travelerId) return { contact: { id: null, profile_name: "Client test", stage: "prospect", qualification: null, traveler_id: null }, traveler: null };
  await assertOwned("travelers", travelerId, agencyId);
  const [traveler] = await query(`SELECT id, full_name FROM travelers WHERE id = ? AND agency_id = ?`, [travelerId, agencyId]);
  return {
    contact: { id: null, profile_name: traveler.full_name, stage: "inscrit", qualification: null, traveler_id: traveler.id },
    traveler,
  };
}

// history : [{ role: "user" | "assistant", text }], dernier message = client.
export async function runSandbox({ history, travelerId = null, settingsVersionId = null, context = "bac_a_sable" }, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const settings = settingsVersionId ? await getSettingsVersion(settingsVersionId, agencyId) : await getActiveSettings(agencyId);
  if (!settings) {
    const err = new Error("Ressource introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
  const { contact, traveler } = await simulatedContact(agencyId, travelerId);
  const messages = [];
  for (const h of history || []) {
    const text = String(h.text || "").trim();
    if (!text) continue;
    const role = h.role === "assistant" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push({ type: "text", text });
    else messages.push({ role, content: [{ type: "text", text }] });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    const err = new Error("Le dernier message doit être celui du client.");
    err.code = "VALIDATION";
    throw err;
  }
  const ctx = {
    agencyId,
    sandbox: true,
    contact,
    latestMedia: null,
    enabledTools: settings.tools_enabled,
    transferHint: await transferMessageFor(agencyId, settings, "fr", "demande_humain"),
    effects: { transfer: null, tasks: [], outbound: [], language: null },
  };
  const firstExchange = messages.filter((m) => m.role === "assistant").length === 0;
  const [stablePrompt, dynamicContext] = await Promise.all([
    buildStablePrompt(agencyId, settings),
    buildDynamicContext(agencyId, settings, { contact, traveler, firstExchange, sandbox: true }),
  ]);
  const result = await runAgent({ settings, messages, stablePrompt, dynamicContext, ctx, log: { context } });
  return {
    text: result.text,
    outcome: result.outcome,
    error: result.error,
    toolCalls: result.toolCalls,
    effects: ctx.effects,
    cost: result.cost,
    usage: result.usage,
    model: result.model,
    settingsVersion: settings.version,
  };
}

// --- Jeu de tests -----------------------------------------------------------

export async function listTestCases(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT tc.*, tr.full_name AS traveler_name FROM ia_test_cases tc
     LEFT JOIN travelers tr ON tr.id = tc.traveler_id AND tr.agency_id = tc.agency_id
     WHERE tc.agency_id = ? ORDER BY tc.id`,
    [agencyId]
  );
}

export async function saveTestCase(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const question = String(data.question || "").trim();
  if (!question) {
    const err = new Error("La question est obligatoire.");
    err.code = "VALIDATION";
    throw err;
  }
  const travelerId = data.travelerId ? Number(data.travelerId) : null;
  if (travelerId) await assertOwned("travelers", travelerId, agencyId);
  const expectTransfer = data.expectTransfer === true || data.expectTransfer === "oui" ? 1 : data.expectTransfer === false || data.expectTransfer === "non" ? 0 : null;
  const values = [question, travelerId ? "inscrit" : "prospect", travelerId, String(data.expectation || "").trim() || null, expectTransfer, data.isActive === false ? 0 : 1];
  if (data.id) {
    await assertOwned("ia_test_cases", data.id, agencyId);
    await query(
      `UPDATE ia_test_cases SET question = ?, profile = ?, traveler_id = ?, expectation = ?, expect_transfer = ?, is_active = ?
       WHERE id = ? AND agency_id = ?`,
      [...values, data.id, agencyId]
    );
    return data.id;
  }
  const result = await query(
    `INSERT INTO ia_test_cases (question, profile, traveler_id, expectation, expect_transfer, is_active, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [...values, agencyId]
  );
  return result.insertId;
}

export async function deleteTestCase(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("ia_test_cases", id, agencyId);
  await query(`DELETE FROM ia_test_cases WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

export function newRunKey() {
  return `${new Date().toISOString().slice(0, 16).replace("T", " ")}-${crypto.randomBytes(3).toString("hex")}`;
}

// Exécuté par le worker : chaque cas, l'un après l'autre (coût maîtrisé).
export async function runTestSuite(runKey, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const cases = await query(`SELECT * FROM ia_test_cases WHERE agency_id = ? AND is_active = TRUE ORDER BY id`, [agencyId]);
  for (const c of cases) {
    let row;
    try {
      const r = await runSandbox({ history: [{ role: "user", text: c.question }], travelerId: c.traveler_id, context: "test" }, agencyId);
      row = {
        response: r.text || (r.effects.transfer ? "(transfert sans message)" : ""),
        transferred: Boolean(r.effects.transfer),
        tools: r.toolCalls.map((t) => t.name),
        cost: r.cost,
        error: r.error,
        version: r.settingsVersion,
      };
    } catch (err) {
      row = { response: null, transferred: false, tools: [], cost: 0, error: err.message, version: null };
    }
    await query(
      `INSERT INTO ia_test_runs (agency_id, run_key, case_id, settings_version, response, transferred, tools, cost_usd, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agencyId, runKey, c.id, row.version, row.response, row.transferred ? 1 : 0, JSON.stringify(row.tools), row.cost || 0, row.error ? String(row.error).slice(0, 500) : null]
    );
  }
  return cases.length;
}

export async function listTestRuns(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT run_key, MIN(created_at) AS started_at, COUNT(*) AS cases, SUM(cost_usd) AS cost, MAX(settings_version) AS settings_version,
       SUM(error IS NOT NULL) AS errors
     FROM ia_test_runs WHERE agency_id = ? GROUP BY run_key ORDER BY started_at DESC LIMIT 20`,
    [agencyId]
  );
}

// Résultats d'un passage, comparés au passage précédent (même cas).
export async function getTestRun(runKey, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT r.*, c.question, c.expectation, c.expect_transfer FROM ia_test_runs r
     JOIN ia_test_cases c ON c.id = r.case_id AND c.agency_id = r.agency_id
     WHERE r.agency_id = ? AND r.run_key = ? ORDER BY r.case_id`,
    [agencyId, runKey]
  );
  if (rows.length === 0) return { rows: [], previousKey: null };
  const [previous] = await query(
    `SELECT run_key FROM ia_test_runs WHERE agency_id = ? AND created_at < ? AND run_key <> ?
     GROUP BY run_key ORDER BY MIN(created_at) DESC LIMIT 1`,
    [agencyId, rows[0].created_at, runKey]
  );
  const prevRows = previous
    ? await query(`SELECT case_id, response, transferred FROM ia_test_runs WHERE agency_id = ? AND run_key = ?`, [agencyId, previous.run_key])
    : [];
  const prevByCase = new Map(prevRows.map((p) => [p.case_id, p]));
  return {
    previousKey: previous?.run_key || null,
    rows: rows.map((r) => {
      const p = prevByCase.get(r.case_id);
      const transferOk = r.expect_transfer == null ? null : Boolean(r.transferred) === Boolean(r.expect_transfer);
      return {
        ...r,
        transferred: Boolean(r.transferred),
        transfer_ok: transferOk,
        previous_response: p?.response ?? null,
        previous_transferred: p ? Boolean(p.transferred) : null,
      };
    }),
  };
}
