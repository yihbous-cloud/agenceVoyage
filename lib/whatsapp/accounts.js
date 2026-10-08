import crypto from "node:crypto";
import { query } from "../db";
import { resolveAgencyId } from "../agencyContext";
import { encryptSecret, decryptSecret, maskSecret } from "../secrets";
import { getPhoneNumberInfo } from "./graph";

// Compte WhatsApp Business d'une agence (table wa_accounts, migration 037).
// Un numéro par agence ; les secrets (jeton système, app secret) sont
// chiffrés (lib/secrets.js) et ne sortent JAMAIS de ce module en clair, sauf
// via getAccountCredentials() — réservé au code serveur (webhook, worker).

const PUBLIC_COLUMNS = `id, agency_id, label, waba_id, phone_number_id, display_phone, status,
  quality_rating, messaging_tier, verified_name, last_webhook_at, last_check_at, last_check_result,
  verify_token, access_token_enc, app_secret_enc, created_at, updated_at`;

function toPublic(row) {
  if (!row) return null;
  const { access_token_enc, app_secret_enc, ...rest } = row;
  let accessTokenMasked = null;
  let appSecretMasked = null;
  let secretsReadable = true;
  try {
    accessTokenMasked = maskSecret(decryptSecret(access_token_enc));
    appSecretMasked = maskSecret(decryptSecret(app_secret_enc));
  } catch {
    // Clé maître changée ou absente : les secrets doivent être ressaisis.
    secretsReadable = false;
  }
  return {
    ...rest,
    has_access_token: Boolean(access_token_enc),
    has_app_secret: Boolean(app_secret_enc),
    access_token_masked: accessTokenMasked,
    app_secret_masked: appSecretMasked,
    secrets_readable: secretsReadable,
  };
}

export async function getAccountForAgency(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT ${PUBLIC_COLUMNS} FROM wa_accounts WHERE agency_id = ? LIMIT 1`, [agencyId]);
  return toPublic(rows[0]);
}

// Secrets déchiffrés — usage serveur uniquement (jamais renvoyés par une API).
export async function getAccountCredentials(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM wa_accounts WHERE agency_id = ? LIMIT 1`, [agencyId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    agencyId: row.agency_id,
    phoneNumberId: row.phone_number_id,
    status: row.status,
    accessToken: decryptSecret(row.access_token_enc),
    appSecret: decryptSecret(row.app_secret_enc),
  };
}

// Routage du webhook (commun à toutes les agences) : l'agence est déduite du
// phone_number_id du message — recherche volontairement globale.
export async function findAccountByPhoneNumberId(phoneNumberId) {
  const rows = await query(
    `SELECT id, agency_id, phone_number_id, waba_id, status, app_secret_enc FROM wa_accounts -- agency-lint-ok: routage webhook, agence déduite du numéro
     WHERE phone_number_id = ? LIMIT 1`,
    [String(phoneNumberId)]
  );
  return rows[0] || null;
}

// Notifications au niveau du compte WhatsApp Business (statut/catégorie des
// templates) : pas de phone_number_id, l'agence est déduite du WABA ID.
export async function findAccountByWabaId(wabaId) {
  const rows = await query(
    `SELECT id, agency_id, phone_number_id, waba_id, status, app_secret_enc FROM wa_accounts -- agency-lint-ok: routage webhook, agence déduite du WABA
     WHERE waba_id = ? LIMIT 1`,
    [String(wabaId)]
  );
  return rows[0] || null;
}

// Abonnement du webhook (GET de Meta) : le jeton de vérification identifie le compte.
export async function findAccountByVerifyToken(token) {
  if (!token) return null;
  const rows = await query(
    `SELECT id, agency_id FROM wa_accounts -- agency-lint-ok: abonnement webhook, agence déduite du jeton
     WHERE verify_token = ? LIMIT 1`,
    [String(token)]
  );
  return rows[0] || null;
}

function newVerifyToken() {
  return crypto.randomBytes(24).toString("hex");
}

// Création ou mise à jour. accessToken / appSecret : remplacés seulement s'ils
// sont fournis (champ laissé vide dans le formulaire = valeur actuelle conservée).
export async function saveAccount(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const phoneNumberId = String(data.phoneNumberId || "").trim();
  if (!/^\d{5,40}$/.test(phoneNumberId)) {
    const err = new Error("Identifiant du numéro (Phone number ID) invalide : chiffres uniquement.");
    err.code = "VALIDATION";
    throw err;
  }
  const status = ["test", "actif", "inactif"].includes(data.status) ? data.status : "test";
  const fields = {
    label: String(data.label || "").trim() || "Numéro principal",
    waba_id: String(data.wabaId || "").trim() || null,
    phone_number_id: phoneNumberId,
    display_phone: String(data.displayPhone || "").trim() || null,
    status,
  };
  if (data.accessToken?.trim()) fields.access_token_enc = encryptSecret(data.accessToken.trim());
  if (data.appSecret?.trim()) fields.app_secret_enc = encryptSecret(data.appSecret.trim());

  const existing = await query(`SELECT id FROM wa_accounts WHERE agency_id = ? LIMIT 1`, [agencyId]);
  try {
    if (existing[0]) {
      const cols = Object.keys(fields);
      const setClause = cols.map((c) => c + " = ?").join(", ");
      await query(
        `UPDATE wa_accounts SET ${setClause} WHERE id = ? AND agency_id = ?`,
        [...cols.map((c) => fields[c]), existing[0].id, agencyId]
      );
    } else {
      const cols = [...Object.keys(fields), "verify_token", "agency_id"];
      const values = [...Object.values(fields), newVerifyToken(), agencyId];
      await query(
        // agency_id figure dans `cols` (ajouté ci-dessus).
        `INSERT INTO wa_accounts (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) -- agency-lint-ok: agency_id inclus dans cols`,
        values
      );
    }
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      const e = new Error("Ce numéro WhatsApp est déjà relié à une autre agence.");
      e.code = "VALIDATION";
      throw e;
    }
    throw err;
  }
  return getAccountForAgency(agencyId);
}

export async function regenerateVerifyToken(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await query(`UPDATE wa_accounts SET verify_token = ? WHERE agency_id = ?`, [newVerifyToken(), agencyId]);
  return getAccountForAgency(agencyId);
}

// Test de connexion : interroge Meta avec le jeton enregistré et met à jour
// nom vérifié / note de qualité / palier d'envoi.
export async function checkAccountConnection(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const creds = await getAccountCredentials(agencyId);
  if (!creds) return { ok: false, message: "Aucun compte WhatsApp configuré." };
  try {
    const info = await getPhoneNumberInfo(creds.accessToken, creds.phoneNumberId);
    await query(
      `UPDATE wa_accounts SET verified_name = ?, display_phone = COALESCE(?, display_phone), quality_rating = ?,
         messaging_tier = ?, last_check_at = UTC_TIMESTAMP(), last_check_result = 'OK'
       WHERE agency_id = ?`,
      [
        info.verified_name || null,
        info.display_phone_number || null,
        info.quality_rating || null,
        info.messaging_limit_tier || null,
        agencyId,
      ]
    );
    return { ok: true, info };
  } catch (err) {
    const message = String(err.message || "Erreur inconnue").slice(0, 250);
    await query(
      `UPDATE wa_accounts SET last_check_at = UTC_TIMESTAMP(), last_check_result = ? WHERE agency_id = ?`,
      [message, agencyId]
    );
    return { ok: false, message };
  }
}

export async function touchAccountWebhook(accountId, agencyId) {
  await query(`UPDATE wa_accounts SET last_webhook_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [
    accountId,
    agencyId,
  ]);
}

export async function updateAccountQuality(agencyId, { qualityRating, messagingTier }) {
  await query(
    `UPDATE wa_accounts SET quality_rating = COALESCE(?, quality_rating), messaging_tier = COALESCE(?, messaging_tier)
     WHERE agency_id = ?`,
    [qualityRating || null, messagingTier || null, agencyId]
  );
}
