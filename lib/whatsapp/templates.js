import { query } from "../db";
import { resolveAgencyId, assertOwned } from "../agencyContext";
import { getAccountCredentials, getAccountForAgency } from "./accounts";
import { listMessageTemplates, createMessageTemplate, editMessageTemplate, deleteMessageTemplate, uploadTemplateSample } from "./graph";
import { sendConversationTemplate } from "./outbound";
import { exampleFor, buildCrmContext } from "./crmContext";
import { notify } from "./team";

// Templates Meta (cahier §7.1, TP-01 à TP-08).
// Modèle : une ligne wa_templates par (nom, langue) — un même NOM regroupe
// les versions française et arabe, comme chez Meta (TP-04). `components` est
// stocké au format Meta ; l'éditeur travaille sur une forme simplifiée
// (en-tête, corps, pied, boutons) convertie dans les deux sens ci-dessous.
// Statut local "BROUILLON" tant que le template n'est pas soumis.
// Correspondance des variables (TP-05) : variable_mapping =
//   { "header.1": champ, "header.media": champ, "body.1": champ, ..., "button.0": champ }
// (champs : CRM_FIELDS, lib/whatsapp/crmContext.js).

export const CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"];
export const LANGUAGES = ["fr", "ar", "en"];
export const HEADER_TYPES = ["NONE", "TEXT", "IMAGE", "DOCUMENT", "LOCATION"];

// Mots qui font reclasser un template "Utilité" en "Marketing" par Meta.
const PROMO_WORDS = ["promo", "promotion", "réduction", "reduction", "remise", "offre spéciale", "gratuit", "profitez", "soldes", "bon plan", "exclusif", "تخفيض", "عرض خاص", "مجانا", "تخفيضات"];

const VAR_RE = /\{\{(\d+)\}\}/g;

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const varsOf = (text) => [...String(text || "").matchAll(VAR_RE)].map((m) => Number(m[1]));

// --- Conversion forme simplifiée <-> composants Meta ------------------------

export function fromComponents(components) {
  const list = parseJson(components, []);
  const header = list.find((c) => c.type === "HEADER");
  const body = list.find((c) => c.type === "BODY");
  const footer = list.find((c) => c.type === "FOOTER");
  const buttons = list.find((c) => c.type === "BUTTONS")?.buttons || [];
  return {
    headerType: header ? header.format || "TEXT" : "NONE",
    headerText: header?.text || "",
    body: body?.text || "",
    footer: footer?.text || "",
    buttons: buttons.map((b) => ({ type: b.type, text: b.text || "", url: b.url || "", phone: b.phone_number || "" })),
  };
}

// Composants Meta, avec les exemples de variables exigés à la soumission.
export function toComponents(simple, mapping = {}, { headerHandle = null } = {}) {
  const components = [];
  if (simple.headerType === "TEXT" && simple.headerText) {
    const vars = varsOf(simple.headerText);
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: simple.headerText,
      ...(vars.length ? { example: { header_text: vars.map((n) => exampleFor(mapping[`header.${n}`])) } } : {}),
    });
  } else if (simple.headerType === "IMAGE" || simple.headerType === "DOCUMENT") {
    components.push({ type: "HEADER", format: simple.headerType, ...(headerHandle ? { example: { header_handle: [headerHandle] } } : {}) });
  } else if (simple.headerType === "LOCATION") {
    components.push({ type: "HEADER", format: "LOCATION" });
  }
  const bodyVars = [...new Set(varsOf(simple.body))].sort((a, b) => a - b);
  components.push({
    type: "BODY",
    text: simple.body,
    ...(bodyVars.length ? { example: { body_text: [bodyVars.map((n) => exampleFor(mapping[`body.${n}`]))] } } : {}),
  });
  if (simple.footer) components.push({ type: "FOOTER", text: simple.footer });
  const buttons = (simple.buttons || []).filter((b) => b.text);
  if (buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: buttons.map((b, i) => {
        if (b.type === "URL") {
          const dynamic = varsOf(b.url).length > 0;
          return { type: "URL", text: b.text, url: b.url, ...(dynamic ? { example: [b.url.replace(VAR_RE, "exemple")] } : {}), _index: i };
        }
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone };
        return { type: "QUICK_REPLY", text: b.text };
      }).map(({ _index, ...b }) => b),
    });
  }
  return components;
}

// --- Contrôles avant soumission (8.11) --------------------------------------

export function validateTemplate(t) {
  const errors = [];
  const warnings = [];
  const s = t.simple;
  if (!/^[a-z0-9_]{1,512}$/.test(t.name || "")) errors.push("Nom : minuscules, chiffres et _ uniquement (ex. gf_paiement_recu).");
  if (!LANGUAGES.includes(t.language)) errors.push("Langue non prise en charge.");
  if (!CATEGORIES.includes(t.category)) errors.push("Catégorie invalide.");
  if (!s.body?.trim()) errors.push("Le corps du message est obligatoire.");
  if ((s.body || "").length > 1024) errors.push("Corps : 1024 caractères maximum.");
  if (s.headerType === "TEXT") {
    if (!s.headerText?.trim()) errors.push("En-tête texte vide.");
    if ((s.headerText || "").length > 60) errors.push("En-tête : 60 caractères maximum.");
    if (varsOf(s.headerText).length > 1) errors.push("En-tête : une seule variable autorisée.");
  }
  if ((s.footer || "").length > 60) errors.push("Pied de message : 60 caractères maximum.");
  if (varsOf(s.footer).length) errors.push("Le pied de message ne peut pas contenir de variable.");

  const vars = varsOf(s.body);
  const unique = [...new Set(vars)].sort((a, b) => a - b);
  if (unique.some((n, i) => n !== i + 1)) errors.push("Les variables doivent se suivre : {{1}}, {{2}}, {{3}}...");
  const trimmed = (s.body || "").trim();
  if (/^\{\{\d+\}\}/.test(trimmed)) errors.push("Le corps ne peut pas commencer par une variable.");
  if (/\{\{\d+\}\}[.!?\s]*$/.test(trimmed)) errors.push("Le corps ne peut pas se terminer par une variable.");
  if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(s.body || "")) errors.push("Deux variables ne peuvent pas être collées.");
  if (unique.length && trimmed.replace(VAR_RE, "").split(/\s+/).filter(Boolean).length < unique.length * 2) {
    warnings.push("Beaucoup de variables pour peu de texte : Meta risque de refuser le template.");
  }
  for (const n of unique) {
    if (!t.mapping?.[`body.${n}`]) errors.push(`Variable {{${n}}} du corps : choisir le champ CRM correspondant.`);
  }
  if (s.headerType === "TEXT") for (const n of varsOf(s.headerText)) if (!t.mapping?.[`header.${n}`]) errors.push(`Variable {{${n}}} de l'en-tête : choisir le champ CRM.`);
  if ((s.headerType === "IMAGE" || s.headerType === "DOCUMENT") && !t.mapping?.["header.media"]) {
    errors.push("En-tête média : choisir le champ qui fournit l'URL du fichier à l'envoi.");
  }

  const buttons = (s.buttons || []).filter((b) => b.text);
  if (buttons.length > 10) errors.push("10 boutons maximum.");
  buttons.forEach((b, i) => {
    if (b.text.length > 25) errors.push(`Bouton ${i + 1} : 25 caractères maximum.`);
    if (b.type === "URL") {
      if (!/^https:\/\//.test(b.url || "")) errors.push(`Bouton ${i + 1} : l'URL doit commencer par https://.`);
      if (varsOf(b.url).length > 1 || (varsOf(b.url).length === 1 && !/\{\{1\}\}$/.test(b.url))) {
        errors.push(`Bouton ${i + 1} : une seule variable {{1}}, en fin d'URL.`);
      }
      if (varsOf(b.url).length === 1 && !t.mapping?.[`button.${i}`]) errors.push(`Bouton ${i + 1} : choisir le champ de la partie variable de l'URL.`);
    }
    if (b.type === "PHONE_NUMBER" && !/^\+\d{8,15}$/.test(b.phone || "")) errors.push(`Bouton ${i + 1} : numéro au format international (+212...).`);
  });

  if (t.category === "UTILITY") {
    const text = `${s.headerText || ""} ${s.body || ""} ${s.footer || ""}`.toLowerCase();
    const found = PROMO_WORDS.filter((w) => text.includes(w));
    if (found.length) warnings.push(`Mots promotionnels dans un template « Utilité » (${found.join(", ")}) : Meta risque de le reclasser en « Marketing », plus cher.`);
  }
  return { errors, warnings };
}

// --- Lecture ------------------------------------------------------------------

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    components: parseJson(row.components, []),
    variable_mapping: parseJson(row.variable_mapping, {}),
    simple: fromComponents(row.components),
  };
}

export async function listTemplates(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT t.*,
       (SELECT COUNT(*) FROM wa_messages m WHERE m.template_id = t.id AND m.agency_id = t.agency_id) AS sent_count,
       (SELECT MAX(m.created_at) FROM wa_messages m WHERE m.template_id = t.id AND m.agency_id = t.agency_id) AS last_used_at
     FROM wa_templates t WHERE t.agency_id = ? ORDER BY t.name, t.language`,
    [agencyId]
  );
  return rows.map(normalize);
}

export async function getTemplate(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [row] = await query(`SELECT * FROM wa_templates WHERE id = ? AND agency_id = ?`, [id, agencyId]);
  if (!row) {
    const err = new Error("Ressource introuvable");
    err.code = "NOT_FOUND";
    throw err;
  }
  return normalize(row);
}

// --- Écriture locale ------------------------------------------------------------

export async function saveTemplateDraft(data, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const t = {
    name: String(data.name || "").trim(),
    language: data.language,
    category: data.category,
    simple: data.simple || {},
    mapping: data.mapping || {},
  };
  // Un brouillon peut être incomplet ; seuls nom, langue et catégorie sont
  // exigés ici (contrôle complet à la soumission, validateTemplate).
  const blocking = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) blocking.push("Nom : minuscules, chiffres et _ uniquement (ex. gf_paiement_recu).");
  if (!LANGUAGES.includes(t.language)) blocking.push("Langue non prise en charge.");
  if (!CATEGORIES.includes(t.category)) blocking.push("Catégorie invalide.");
  if (blocking.length) {
    const err = new Error(blocking.join(" "));
    err.code = "VALIDATION";
    throw err;
  }
  const components = JSON.stringify(toComponents(t.simple, t.mapping));
  if (data.id) {
    const current = await getTemplate(data.id, agencyId);
    if (current.status === "APPROVED" || current.status === "PENDING") {
      // Un template en cours d'examen ou approuvé n'est pas modifié en place :
      // seule sa correspondance de variables peut changer (aucun impact Meta).
      await query(`UPDATE wa_templates SET variable_mapping = ?, description = ? WHERE id = ? AND agency_id = ?`, [
        JSON.stringify(t.mapping),
        data.description || null,
        data.id,
        agencyId,
      ]);
      return getTemplate(data.id, agencyId);
    }
    await query(
      `UPDATE wa_templates SET name = ?, language = ?, category_requested = ?, components = ?, variable_mapping = ?, description = ?
       WHERE id = ? AND agency_id = ?`,
      [t.name, t.language, t.category, components, JSON.stringify(t.mapping), data.description || null, data.id, agencyId]
    );
    return getTemplate(data.id, agencyId);
  }
  try {
    const result = await query(
      `INSERT INTO wa_templates (agency_id, name, language, category_requested, status, components, variable_mapping, description, origin)
       VALUES (?, ?, ?, ?, 'BROUILLON', ?, ?, ?, 'local')`,
      [agencyId, t.name, t.language, t.category, components, JSON.stringify(t.mapping), data.description || null]
    );
    return getTemplate(result.insertId, agencyId);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      const e = new Error("Un template existe déjà avec ce nom et cette langue.");
      e.code = "VALIDATION";
      throw e;
    }
    throw err;
  }
}

export async function duplicateTemplate(id, { name, language } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const t = await getTemplate(id, agencyId);
  return saveTemplateDraft(
    {
      name: name || `${t.name}_copie`,
      language: language || t.language,
      category: t.category_requested || t.category || "UTILITY",
      simple: t.simple,
      mapping: t.variable_mapping,
      description: t.description,
    },
    agencyId
  );
}

export async function deleteTemplate(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const t = await getTemplate(id, agencyId);
  if (t.meta_template_id) {
    const [others] = await query(`SELECT COUNT(*) AS n FROM wa_templates WHERE agency_id = ? AND name = ? AND id <> ?`, [agencyId, t.name, id]);
    // Meta supprime un template par NOM (toutes langues) : seulement si c'est la dernière langue.
    if (Number(others.n) === 0) {
      const account = await getAccountForAgency(agencyId);
      const creds = await getAccountCredentials(agencyId);
      if (account?.waba_id && creds?.accessToken) await deleteMessageTemplate(creds.accessToken, account.waba_id, t.name);
    }
  }
  await query(`UPDATE wa_messages SET template_id = NULL WHERE template_id = ? AND agency_id = ?`, [id, agencyId]);
  await query(`DELETE FROM wa_templates WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// --- Soumission à Meta (TP-01) -------------------------------------------------

export async function submitTemplate(id, { headerSample = null } = {}, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const t = await getTemplate(id, agencyId);
  const category = t.category_requested || t.category || "UTILITY";
  const { errors } = validateTemplate({ name: t.name, language: t.language, category, simple: t.simple, mapping: t.variable_mapping });
  if (errors.length) {
    const err = new Error(errors.join(" "));
    err.code = "VALIDATION";
    throw err;
  }
  const account = await getAccountForAgency(agencyId);
  const creds = await getAccountCredentials(agencyId);
  if (!account?.waba_id || !creds?.accessToken) {
    const err = new Error("Compte WhatsApp incomplet : identifiant WABA et jeton nécessaires pour soumettre un template.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  let headerHandle = null;
  if (t.simple.headerType === "IMAGE" || t.simple.headerType === "DOCUMENT") {
    if (!headerSample) {
      const err = new Error("Joindre un fichier d'exemple pour l'en-tête média (exigé par Meta).");
      err.code = "VALIDATION";
      throw err;
    }
    headerHandle = await uploadTemplateSample(creds.accessToken, process.env.META_APP_ID, headerSample);
  }
  const components = toComponents(t.simple, t.variable_mapping, { headerHandle });
  let result;
  if (t.meta_template_id && t.status !== "BROUILLON") {
    result = await editMessageTemplate(creds.accessToken, t.meta_template_id, { components, category });
    result = { id: t.meta_template_id, status: "PENDING", category, ...result };
  } else {
    result = await createMessageTemplate(creds.accessToken, account.waba_id, { name: t.name, language: t.language, category, components });
  }
  await query(
    `UPDATE wa_templates SET meta_template_id = ?, status = ?, category = ?, category_requested = ?, components = ?, rejection_reason = NULL,
       submitted_at = UTC_TIMESTAMP(), origin = 'local'
     WHERE id = ? AND agency_id = ?`,
    [result.id || t.meta_template_id, result.status || "PENDING", result.category || category, category, JSON.stringify(components), id, agencyId]
  );
  return getTemplate(id, agencyId);
}

// --- Synchronisation des statuts (TP-02, TP-03) ----------------------------------

async function alertReclassification(agencyId, row, newCategory) {
  await notify(
    {
      team: "direction",
      kind: "template_reclasse",
      title: `Template « ${row.name} » (${row.language}) reclassé par Meta : ${row.category_requested || row.category} → ${newCategory}`,
      body: "Un template « Marketing » coûte plus cher et exige le consentement marketing du destinataire.",
    },
    agencyId
  );
}

export async function syncTemplates(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const account = await getAccountForAgency(agencyId);
  if (!account?.waba_id) {
    const err = new Error("Renseignez l'identifiant du compte WhatsApp Business (WABA ID) pour synchroniser les templates.");
    err.code = "VALIDATION";
    throw err;
  }
  const creds = await getAccountCredentials(agencyId);
  const remote = await listMessageTemplates(creds.accessToken, account.waba_id);
  for (const t of remote) {
    const [existing] = await query(`SELECT id, name, language, category, category_requested, status FROM wa_templates WHERE agency_id = ? AND name = ? AND language = ?`, [
      agencyId,
      t.name,
      t.language,
    ]);
    if (existing) {
      const requested = existing.category_requested || existing.category;
      if (requested === "UTILITY" && t.category === "MARKETING" && existing.category !== "MARKETING") await alertReclassification(agencyId, existing, t.category);
      await query(
        `UPDATE wa_templates SET meta_template_id = ?, category = ?, status = ?, components = ?, synced_at = UTC_TIMESTAMP(),
           rejection_reason = IF(? = 'REJECTED', COALESCE(?, rejection_reason), NULL)
         WHERE id = ? AND agency_id = ?`,
        [t.id || null, t.category || null, t.status || null, JSON.stringify(t.components || []), t.status, t.rejected_reason || null, existing.id, agencyId]
      );
    } else {
      await query(
        `INSERT INTO wa_templates (agency_id, meta_template_id, name, language, category, category_requested, status, components, synced_at, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'meta')`,
        [agencyId, t.id || null, t.name, t.language, t.category || null, t.category || null, t.status || null, JSON.stringify(t.components || [])]
      );
    }
  }
  return remote.length;
}

// Webhook Meta : changement de statut ou de catégorie d'un template.
export async function applyTemplateWebhook(agencyId, field, value) {
  const metaId = String(value.message_template_id || "");
  const rows = metaId
    ? await query(`SELECT * FROM wa_templates WHERE agency_id = ? AND meta_template_id = ?`, [agencyId, metaId])
    : await query(`SELECT * FROM wa_templates WHERE agency_id = ? AND name = ? AND language = ?`, [agencyId, value.message_template_name, value.message_template_language]);
  for (const row of rows) {
    if (field === "message_template_status_update") {
      await query(`UPDATE wa_templates SET status = ?, rejection_reason = ?, synced_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [
        value.event,
        value.event === "REJECTED" ? String(value.reason || "").slice(0, 255) || null : null,
        row.id,
        agencyId,
      ]);
      if (value.event === "REJECTED" || value.event === "PAUSED" || value.event === "DISABLED") {
        await notify(
          { team: "direction", kind: "template_statut", title: `Template « ${row.name} » (${row.language}) : ${value.event}${value.reason ? ` — ${value.reason}` : ""}` },
          agencyId
        );
      }
    } else if (field === "template_category_update") {
      const newCategory = value.new_category || value.correct_category;
      if (newCategory && newCategory !== row.category) {
        await query(`UPDATE wa_templates SET category = ? WHERE id = ? AND agency_id = ?`, [newCategory, row.id, agencyId]);
        if ((row.category_requested || row.category) === "UTILITY" && newCategory === "MARKETING") await alertReclassification(agencyId, row, newCategory);
      }
    }
  }
}

// --- Statistiques (TP-07) -------------------------------------------------------

export async function templateStats(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT t.id, t.name, t.language,
       COUNT(m.id) AS sent,
       SUM(m.status IN ('livre', 'lu')) AS delivered,
       SUM(m.status = 'lu') AS read_count,
       SUM(m.status = 'echec') AS failed,
       SUM(EXISTS (SELECT 1 FROM wa_messages r WHERE r.conversation_id = m.conversation_id AND r.agency_id = m.agency_id
                   AND r.direction = 'entrant' AND r.created_at > m.created_at AND r.created_at < m.created_at + INTERVAL 24 HOUR)) AS replies
     FROM wa_templates t
     LEFT JOIN wa_messages m ON m.template_id = t.id AND m.agency_id = t.agency_id AND m.created_at > UTC_TIMESTAMP() - INTERVAL 30 DAY
     WHERE t.agency_id = ?
     GROUP BY t.id, t.name, t.language`,
    [agencyId]
  );
}

// --- Rendu et envoi -------------------------------------------------------------

// Valeurs des variables pour un destinataire (contexte : buildCrmContext).
export function renderTemplate(template, context) {
  const t = template.simple ? template : normalize(template);
  const mapping = t.variable_mapping || {};
  const value = (key) => {
    const field = mapping[key];
    const v = field ? context[field] : "";
    return v == null || v === "" ? "-" : String(v);
  };
  const fill = (text, prefix) => String(text || "").replace(VAR_RE, (_, n) => value(`${prefix}.${n}`));
  const components = [];
  const s = t.simple;
  if (s.headerType === "TEXT" && varsOf(s.headerText).length) {
    components.push({ type: "header", parameters: varsOf(s.headerText).map((n) => ({ type: "text", text: value(`header.${n}`) })) });
  } else if (s.headerType === "IMAGE" || s.headerType === "DOCUMENT") {
    const link = context[mapping["header.media"]] || "";
    components.push({ type: "header", parameters: [{ type: s.headerType.toLowerCase(), [s.headerType.toLowerCase()]: { link } }] });
  }
  const bodyVars = [...new Set(varsOf(s.body))].sort((a, b) => a - b);
  if (bodyVars.length) components.push({ type: "body", parameters: bodyVars.map((n) => ({ type: "text", text: value(`body.${n}`) })) });
  (s.buttons || []).forEach((b, i) => {
    if (b.type === "URL" && varsOf(b.url).length) {
      components.push({ type: "button", sub_type: "url", index: String(i), parameters: [{ type: "text", text: value(`button.${i}`) }] });
    }
  });
  return {
    components,
    header: s.headerType === "TEXT" ? fill(s.headerText, "header") : s.headerType !== "NONE" ? `[${s.headerType}]` : "",
    body: fill(s.body, "body"),
    footer: s.footer || "",
    buttons: (s.buttons || []).filter((b) => b.text).map((b) => b.text),
    text: [s.headerType === "TEXT" ? fill(s.headerText, "header") : "", fill(s.body, "body"), s.footer || ""].filter(Boolean).join("\n\n"),
  };
}

// Version d'un template (famille = nom) dans la langue du contact (TP-04) :
// arabe pour un contact arabophone (arabe ou darija en lettres arabes),
// français sinon ; repli sur toute autre langue APPROUVÉE.
export async function pickTemplateVariant(agencyId, name, contactLanguage, { approvedOnly = true } = {}) {
  const rows = await query(
    `SELECT * FROM wa_templates WHERE agency_id = ? AND name = ? ${approvedOnly ? "AND status = 'APPROVED'" : ""}`,
    [agencyId, name]
  );
  if (rows.length === 0) return null;
  const wanted = contactLanguage === "ar" || contactLanguage === "darija_arabe" ? ["ar", "fr", "en"] : contactLanguage === "en" ? ["en", "fr", "ar"] : ["fr", "ar", "en"];
  for (const lang of wanted) {
    const row = rows.find((r) => r.language === lang || r.language.startsWith(`${lang}_`));
    if (row) return normalize(row);
  }
  return normalize(rows[0]);
}

export async function listApprovedTemplates(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM wa_templates WHERE agency_id = ? AND status = 'APPROVED' ORDER BY name, language`, [agencyId]);
  return rows.map((r) => {
    const t = normalize(r);
    const free = [...new Set(varsOf(t.simple.body))].filter((n) => !t.variable_mapping[`body.${n}`]);
    return { ...t, variables: [...new Set(varsOf(t.simple.body))].length, unmapped: free, preview: renderTemplate(t, {}).body };
  });
}

export function bodyVariableCount(template) {
  const t = template.simple ? template : normalize(template);
  return new Set(varsOf(t.simple.body)).size;
}

// Envoi d'un template à une conversation. `context` = valeurs CRM ;
// `manual` = valeurs saisies à la main pour les variables non associées.
export async function sendTemplateToConversationWithContext(agencyId, conversationId, template, context, { staffId = null, author = "humain", manual = {}, campaignId = null } = {}) {
  const t = template.simple ? template : normalize(template);
  const merged = { ...context };
  for (const [n, v] of Object.entries(manual)) {
    if (!t.variable_mapping[`body.${n}`]) {
      t.variable_mapping = { ...t.variable_mapping, [`body.${n}`]: `__manual_${n}` };
      merged[`__manual_${n}`] = v;
    }
  }
  const rendered = renderTemplate(t, merged);
  return sendConversationTemplate(agencyId, conversationId, t, rendered.components, rendered.text, { staffId, author, campaignId });
}

// Envoi depuis l'inbox (fenêtre fermée, HU-08) : variables associées au CRM
// remplies automatiquement, les autres saisies par le conseiller.
export async function sendTemplateToConversation(session, conversationId, templateId, params, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("wa_templates", templateId, agencyId);
  const t = await getTemplate(templateId, agencyId);
  if (t.status !== "APPROVED") {
    const err = new Error("Template non approuvé par Meta.");
    err.code = "VALIDATION";
    throw err;
  }
  const [conv] = await query(
    `SELECT c.contact_id, ct.traveler_id FROM wa_conversations c JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE c.id = ? AND c.agency_id = ?`,
    [conversationId, agencyId]
  );
  const [reg] = conv?.traveler_id
    ? await query(`SELECT id FROM registrations WHERE traveler_id = ? AND agency_id = ? AND status <> 'annule' ORDER BY id DESC LIMIT 1`, [conv.traveler_id, agencyId])
    : [null];
  const context = await buildCrmContext(agencyId, { registrationId: reg?.id || null, contactId: conv?.contact_id || null });
  const manual = {};
  const unmapped = [...new Set(varsOf(t.simple.body))].filter((n) => !t.variable_mapping[`body.${n}`]);
  unmapped.forEach((n, i) => {
    manual[n] = String(params?.[i] ?? "").trim();
  });
  if (Object.values(manual).some((v) => !v)) {
    const err = new Error(`Ce template attend ${unmapped.length} variable(s).`);
    err.code = "VALIDATION";
    throw err;
  }
  return sendTemplateToConversationWithContext(agencyId, conversationId, t, context, { staffId: session.id, manual });
}

// Charge les 21 templates proposés (lib/whatsapp/defaultTemplates.js) en
// BROUILLON, sans écraser un template existant du même nom et de même langue.
export async function seedDefaultTemplates(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const { DEFAULT_TEMPLATES, defaultTemplateSimple } = await import("./defaultTemplates");
  let created = 0;
  for (const def of DEFAULT_TEMPLATES) {
    for (const language of ["fr", "ar"]) {
      if (!def[language]) continue;
      const [exists] = await query(`SELECT id FROM wa_templates WHERE agency_id = ? AND name = ? AND language = ?`, [agencyId, def.name, language]);
      if (exists) continue;
      const simple = defaultTemplateSimple(def[language]);
      await query(
        `INSERT INTO wa_templates (agency_id, name, language, category_requested, status, components, variable_mapping, description, origin)
         VALUES (?, ?, ?, ?, 'BROUILLON', ?, ?, ?, 'local')`,
        [agencyId, def.name, language, def.category, JSON.stringify(toComponents(simple, def.mapping)), JSON.stringify(def.mapping), def.description]
      );
      created += 1;
    }
  }
  return created;
}
