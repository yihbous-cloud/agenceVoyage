import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";

// Multi-agences (CLAUDE.md §3sexvicies, passe 2) : les paramètres d'une agence
// vivent dans la table `agencies` (la table agency_settings, ligne unique,
// est dépréciée — conservée en base pour l'historique, plus lue ni écrite).
// `explicitAgencyId` : pages publiques statiques (l'agence vient du segment
// d'URL [agency]) ; sinon l'agence de la requête courante.
export async function getAgencySettings(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM agencies WHERE id = ? LIMIT 1`, [agencyId]);
  const settings = rows[0] || null;
  if (!settings) return null;
  settings.social_links = await listAgencySocialLinks(agencyId);
  return settings;
}

// Identifiant Google Tag Manager : « GTM- » suivi de lettres/chiffres.
export const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

const textOrNull = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text === "" ? null : text;
};

export async function updateAgencySettings(data) {
  const agencyId = await resolveAgencyId();
  const gtm = textOrNull(data.gtmContainerId)?.toUpperCase() || null;
  await query(
    `UPDATE agencies SET
       name = ?, logo_url = ?, address = ?, city = ?, phone = ?, whatsapp = ?, email = ?,
       website = ?, rc = ?, tax_id = ?, ice = ?, footer_note = ?,
       legal_name = ?, legal_form = ?, share_capital = ?, publication_director = ?,
       license_number = ?, founding_date = ?, insurance_info = ?, cndp_number = ?,
       hosting_provider = ?, cgv_fr = ?, cgv_ar = ?, gtm_container_id = ?
     WHERE id = ?`,
    [
      data.name,
      data.logoUrl || null,
      data.address || null,
      data.city || null,
      data.phone || null,
      data.whatsapp || null,
      data.email || null,
      data.website || null,
      data.rc || null,
      data.taxId || null,
      data.ice || null,
      data.footerNote || null,
      // Informations légales, CGV, mesure d'audience (migration 046)
      textOrNull(data.legalName),
      textOrNull(data.legalForm),
      textOrNull(data.shareCapital),
      textOrNull(data.publicationDirector),
      textOrNull(data.licenseNumber),
      textOrNull(data.foundingDate),
      textOrNull(data.insuranceInfo),
      textOrNull(data.cndpNumber),
      textOrNull(data.hostingProvider),
      textOrNull(data.cgvFr),
      textOrNull(data.cgvAr),
      gtm,
      agencyId,
    ]
  );
  return getAgencySettings(agencyId);
}

// Réseaux sociaux — liste extensible (n'importe quelle plateforme en texte
// libre, pas seulement un jeu figé de colonnes), affichée dans le footer
// public et éditable depuis /admin/parametres. Voir CLAUDE.md.
export async function listAgencySocialLinks(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT id, platform, url FROM agency_social_links
     WHERE agency_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [agencyId]
  );
}

// Remplacement complet (purge + réinsertion) — même pattern que
// setRolePermissions/setDefaultHotelsForProgram : la liste entière est
// renvoyée à chaque enregistrement du formulaire, pas de diff ligne à ligne.
export async function setAgencySocialLinks(links) {
  const agencyId = await resolveAgencyId();
  await query(`DELETE FROM agency_social_links WHERE agency_id = ?`, [agencyId]);

  const entries = (links || []).filter((l) => l.platform?.trim() && l.url?.trim());
  for (let i = 0; i < entries.length; i++) {
    await query(
      `INSERT INTO agency_social_links (agency_id, platform, url, sort_order) VALUES (?, ?, ?, ?)`,
      [agencyId, entries[i].platform.trim(), entries[i].url.trim(), i]
    );
  }

  return listAgencySocialLinks(agencyId);
}

// Bouton WhatsApp flottant du site public (migration 049), réglé depuis
// « Paramètres WhatsApp ». Renvoie l'état avant/après (journal d'audit).
const BUTTON_COLUMNS = "wa_button_enabled, wa_button_number, wa_button_message_ar, wa_button_message_fr";

export async function getWhatsAppButtonSettings(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT whatsapp, ${BUTTON_COLUMNS} FROM agencies WHERE id = ? LIMIT 1`, [agencyId]);
  const row = rows[0] || {};
  return {
    enabled: Boolean(Number(row.wa_button_enabled ?? 1)),
    number: row.wa_button_number || "",
    messageAr: row.wa_button_message_ar || "",
    messageFr: row.wa_button_message_fr || "",
    agencyWhatsapp: row.whatsapp || "",
  };
}

export async function updateWhatsAppButtonSettings(data) {
  const agencyId = await resolveAgencyId();
  const number = textOrNull(data.number);
  if (number && !/^[+\d][\d\s.()-]{5,28}$/.test(number)) {
    const err = new Error("Numéro WhatsApp invalide");
    err.code = "VALIDATION";
    throw err;
  }
  const messageAr = textOrNull(data.messageAr);
  const messageFr = textOrNull(data.messageFr);
  if ((messageAr && messageAr.length > 500) || (messageFr && messageFr.length > 500)) {
    const err = new Error("Le message ne doit pas dépasser 500 caractères");
    err.code = "VALIDATION";
    throw err;
  }
  const before = await getWhatsAppButtonSettings(agencyId);
  await query(
    `UPDATE agencies SET wa_button_enabled = ?, wa_button_number = ?, wa_button_message_ar = ?, wa_button_message_fr = ? WHERE id = ?`,
    [data.enabled === false ? 0 : 1, number, messageAr, messageFr, agencyId]
  );
  return { before, after: await getWhatsAppButtonSettings(agencyId) };
}
