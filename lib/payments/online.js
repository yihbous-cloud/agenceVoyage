import crypto from "node:crypto";
import { query } from "../db";
import { resolveAgencyId, assertOwned, runWithAgency } from "../agencyContext";
import { encryptSecret, decryptSecret } from "../secrets";
import { getAgencyById } from "../agencies";
import { siteBaseUrl } from "../i18n/seo";
import { createPayment, createGroupPayment } from "../payments";
import { notify } from "../whatsapp/team";
import * as stripe from "./gateways/stripe";
import * as paypal from "./gateways/paypal";
import * as cmi from "./gateways/cmi";

// Paiement en ligne (cahier §2 « lien de paiement », 8.17 « Paiement »).
// Plusieurs passerelles au choix de chaque agence (décision : « tous les
// modèles ») : Stripe, PayPal, CMI, et le virement (RIB, sans paiement en
// ligne). Principes :
//   - montant et référence fixés CÔTÉ SERVEUR à la création du lien ;
//   - le paiement n'entre dans le CRM (createPayment → reçu, statut,
//     déclencheur « paiement reçu ») QUE sur notification signée de la
//     passerelle (ou capture serveur pour PayPal), jamais sur le simple
//     retour du navigateur ;
//   - un montant notifié différent du montant du lien n'est pas enregistré.
// ⚠️ Aucune passerelle n'a pu être testée réellement (aucun compte fourni).

export const PROVIDERS = { stripe, paypal, cmi, virement: { LABEL: "Virement bancaire (RIB)", SECRET_FIELDS: [], PUBLIC_FIELDS: ["instructions"] } };

const toSql = (d) => d.toISOString().slice(0, 19).replace("T", " ");
const parse = (v, fallback) => (v == null ? fallback : typeof v === "object" ? v : JSON.parse(v));

// --- Configuration des passerelles -------------------------------------------

export async function listGateways(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM payment_gateways WHERE agency_id = ?`, [agencyId]);
  return Object.entries(PROVIDERS).map(([provider, mod]) => {
    const row = rows.find((r) => r.provider === provider);
    let secrets = {};
    let readable = true;
    try {
      secrets = row?.secret_config_enc ? JSON.parse(decryptSecret(row.secret_config_enc)) : {};
    } catch {
      readable = false;
    }
    return {
      provider,
      label: mod.LABEL,
      secretFields: mod.SECRET_FIELDS,
      publicFields: mod.PUBLIC_FIELDS,
      isActive: Boolean(row?.is_active),
      mode: row?.mode || "test",
      publicConfig: parse(row?.public_config, {}),
      // Secrets jamais renvoyés : seulement « renseigné ou non ».
      secretsSet: Object.fromEntries(mod.SECRET_FIELDS.map((f) => [f, Boolean(secrets[f])])),
      secretsReadable: readable,
    };
  });
}

export async function saveGateway(provider, data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const mod = PROVIDERS[provider];
  if (!mod) throw Object.assign(new Error("Passerelle inconnue"), { code: "VALIDATION" });
  const [row] = await query(`SELECT * FROM payment_gateways WHERE agency_id = ? AND provider = ?`, [agencyId, provider]);
  const current = row?.secret_config_enc ? JSON.parse(decryptSecret(row.secret_config_enc)) : {};
  const secrets = { ...current };
  for (const f of mod.SECRET_FIELDS) if (data.secrets?.[f]?.trim()) secrets[f] = data.secrets[f].trim();
  const publicConfig = {};
  for (const f of mod.PUBLIC_FIELDS) if (data.publicConfig?.[f] != null) publicConfig[f] = String(data.publicConfig[f]).trim();
  if (provider === "paypal") publicConfig.live = data.publicConfig?.live === true || data.publicConfig?.live === "true";
  const mode = mod.modeFromSecrets ? mod.modeFromSecrets(secrets, publicConfig) : "test";
  const values = [mode, JSON.stringify(publicConfig), Object.keys(secrets).length ? encryptSecret(JSON.stringify(secrets)) : null, data.isActive ? 1 : 0];
  if (row) {
    await query(`UPDATE payment_gateways SET mode = ?, public_config = ?, secret_config_enc = ?, is_active = ? WHERE id = ? AND agency_id = ?`, [...values, row.id, agencyId]);
  } else {
    await query(`INSERT INTO payment_gateways (mode, public_config, secret_config_enc, is_active, agency_id, provider) VALUES (?, ?, ?, ?, ?, ?)`, [
      ...values,
      agencyId,
      provider,
    ]);
  }
  return listGateways(agencyId);
}

async function gatewayRuntime(agencyId, provider) {
  const [row] = await query(`SELECT * FROM payment_gateways WHERE agency_id = ? AND provider = ? AND is_active = TRUE`, [agencyId, provider]);
  if (!row) throw Object.assign(new Error("Passerelle de paiement non activée."), { code: "VALIDATION" });
  return {
    mode: row.mode,
    publicConfig: parse(row.public_config, {}),
    secrets: row.secret_config_enc ? JSON.parse(decryptSecret(row.secret_config_enc)) : {},
  };
}

// --- Liens de paiement --------------------------------------------------------

function newReference() {
  return `PAY-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

// Solde restant d'une inscription (ou de son groupe).
async function balanceOf(agencyId, registrationId) {
  const [r] = await query(
    `SELECT r.id, r.group_id, r.total_due, rg.total_due AS group_total_due, tr.full_name, tr.email, tr.phone_whatsapp, p.title
     FROM registrations r JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id AND rg.agency_id = r.agency_id
     WHERE r.id = ? AND r.agency_id = ?`,
    [registrationId, agencyId]
  );
  if (!r) return null;
  const [paid] = r.group_id
    ? await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE group_id = ? AND agency_id = ?`, [r.group_id, agencyId])
    : await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE registration_id = ? AND agency_id = ?`, [r.id, agencyId]);
  const due = Number(r.group_id ? r.group_total_due : r.total_due) || 0;
  return { ...r, balance: Math.max(0, due - Number(paid.paid || 0)) };
}

export async function createPaymentLink({ provider, registrationId, amount, conversationId = null }, staffId, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("registrations", registrationId, agencyId);
  if (conversationId) await assertOwned("wa_conversations", conversationId, agencyId);
  const info = await balanceOf(agencyId, registrationId);
  const value = Number(amount || info.balance);
  if (!(value > 0)) throw Object.assign(new Error("Montant invalide (le dossier est peut-être déjà réglé)."), { code: "VALIDATION" });
  if (value > info.balance + 0.001) throw Object.assign(new Error(`Le montant dépasse le reste à payer (${info.balance} MAD).`), { code: "VALIDATION" });
  const reference = newReference();
  const description = `${info.title} — dossier GF-${info.id}`;
  const agency = await getAgencyById(agencyId);
  const base = siteBaseUrl(agency?.subdomain);
  const result = await query(
    `INSERT INTO payment_links (agency_id, provider, reference, registration_id, group_id, conversation_id, amount, currency, description, created_by_staff_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'MAD', ?, ?)`,
    [agencyId, provider, reference, info.group_id ? null : registrationId, info.group_id || null, conversationId, value, description, staffId || null]
  );
  const linkId = result.insertId;
  const publicUrl = `${base}/api/paiement/${reference}`;
  let checkoutUrl = publicUrl;
  let externalId = null;
  let mode = "test";
  if (provider === "stripe" || provider === "paypal") {
    const rt = await gatewayRuntime(agencyId, provider);
    mode = rt.mode;
    const out = await PROVIDERS[provider].createCheckout({
      ...rt,
      amount: value,
      currency: "MAD",
      reference,
      description,
      successUrl: `${publicUrl}/retour?statut=ok`,
      cancelUrl: `${publicUrl}/retour?statut=annule`,
    });
    checkoutUrl = out.url;
    externalId = out.externalId;
  } else if (provider === "cmi" || provider === "virement") {
    mode = (await gatewayRuntime(agencyId, provider)).mode;
  }
  await query(`UPDATE payment_links SET checkout_url = ?, external_id = ?, mode = ? WHERE id = ? AND agency_id = ?`, [checkoutUrl, externalId, mode, linkId, agencyId]);
  // Le client reçoit toujours NOTRE URL (/api/paiement/<réf>) : elle redirige
  // vers la passerelle et reste valable même si la session de paiement expire.
  return { id: linkId, reference, url: publicUrl, amount: value, provider, mode };
}

export async function listPaymentLinks(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT pl.*, tr.full_name, su.full_name AS created_by
     FROM payment_links pl
     LEFT JOIN registrations r ON r.id = pl.registration_id AND r.agency_id = pl.agency_id
     LEFT JOIN registration_groups rg ON rg.id = pl.group_id AND rg.agency_id = pl.agency_id
     LEFT JOIN travelers tr ON tr.id = COALESCE(r.traveler_id,
        (SELECT r2.traveler_id FROM registrations r2 WHERE r2.id = rg.responsible_registration_id AND r2.agency_id = pl.agency_id)) AND tr.agency_id = pl.agency_id
     LEFT JOIN staff_users su ON su.id = pl.created_by_staff_id AND su.agency_id = pl.agency_id
     WHERE pl.agency_id = ? ORDER BY pl.id DESC LIMIT 200`,
    [agencyId]
  );
}

export async function cancelPaymentLink(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("payment_links", id, agencyId);
  await query(`UPDATE payment_links SET status = 'annule' WHERE id = ? AND agency_id = ? AND status = 'cree'`, [id, agencyId]);
}

// Lien public (sans session) : recherche par référence, toutes agences — la
// référence aléatoire est la seule clé d'accès.
export async function findLinkByReference(reference) {
  const [row] = await query(
    `SELECT * FROM payment_links WHERE reference = ? -- agency-lint-ok: référence publique unique, agence portée par la ligne
     LIMIT 1`,
    [String(reference || "")]
  );
  return row || null;
}

export async function runtimeForLink(link) {
  return gatewayRuntime(link.agency_id, link.provider);
}

// Enregistre le paiement confirmé (idempotent : une seule fois par lien).
export async function confirmLinkPayment(link, { amount, externalId, event }) {
  const agencyId = link.agency_id;
  const expected = Number(link.amount);
  const converted = link.provider === "paypal";
  if (!converted && Math.abs(Number(amount) - expected) > 0.01) {
    await query(`UPDATE payment_links SET status = 'echec', last_event = ? WHERE id = ? AND agency_id = ?`, [JSON.stringify(event || {}), link.id, agencyId]);
    await notify({ team: "comptabilite", kind: "paiement_anomalie", title: `Paiement en ligne ${link.reference} : montant reçu ${amount} ≠ ${expected} MAD — à vérifier` }, agencyId);
    return { recorded: false, reason: "montant" };
  }
  const claim = await query(
    `UPDATE payment_links SET status = 'paye', paid_at = ?, external_id = COALESCE(?, external_id), last_event = ?
     WHERE id = ? AND agency_id = ? AND status IN ('cree', 'echec')`,
    [toSql(new Date()), externalId || null, JSON.stringify(event || {}), link.id, agencyId]
  );
  if (claim.affectedRows !== 1) return { recorded: false, reason: "déjà traité" };
  const data = { amount: expected, paymentMethod: "carte", notes: `Paiement en ligne ${link.provider} — ${link.reference}` };
  const paymentId = await runWithAgency(agencyId, () =>
    link.group_id ? createGroupPayment(link.group_id, data, null) : createPayment(link.registration_id, data, null)
  );
  await query(`UPDATE payment_links SET payment_id = ? WHERE id = ? AND agency_id = ?`, [paymentId, link.id, agencyId]);
  await notify({ team: "comptabilite", kind: "paiement_en_ligne", title: `Paiement en ligne reçu : ${expected} MAD (${link.reference})`, conversationId: link.conversation_id }, agencyId);
  return { recorded: true, paymentId };
}
