// Client minimal de la WhatsApp Cloud API (Meta Graph API). Aucune
// dépendance : fetch natif. Le jeton est TOUJOURS passé par l'appelant
// (secret propre à chaque agence, déchiffré côté serveur, jamais exposé au
// navigateur). Version de l'API configurable : META_GRAPH_API_VERSION.
// ⚠️ Écrit d'après la documentation Meta ; à valider avec le numéro de test
// de l'agence avant toute mise en production (CLAUDE.md, Lot 0).

// META_GRAPH_BASE_URL : faux serveur Meta pour les tests automatisés
// (scripts/whatsapp-webhook-test.mjs) — ignoré en production.
function graphBase() {
  return (process.env.NODE_ENV !== "production" && process.env.META_GRAPH_BASE_URL) || "https://graph.facebook.com";
}

export function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v23.0";
}

export class GraphApiError extends Error {
  constructor(message, { status, code, subcode, details } = {}) {
    super(message);
    this.name = "GraphApiError";
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.details = details;
  }
}

async function graphRequest(path, { token, method = "GET", body, timeoutMs = 15000 } = {}) {
  if (!token) throw new GraphApiError("Jeton d'accès WhatsApp non configuré");
  const res = await fetch(`${graphBase()}/${graphVersion()}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new GraphApiError(e.message || `Erreur Graph API (${res.status})`, {
      status: res.status,
      code: e.code,
      subcode: e.error_subcode,
      details: e.error_data?.details,
    });
  }
  return data;
}

// Informations du numéro (test de connexion depuis l'admin).
export function getPhoneNumberInfo(token, phoneNumberId) {
  return graphRequest(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status`,
    { token }
  );
}

// Message texte libre — possible uniquement dans la fenêtre de 24h qui suit
// le dernier message du client (sinon Meta exige un template).
export async function sendTextMessage(token, phoneNumberId, to, text, { replyToMetaId } = {}) {
  const data = await graphRequest(`${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: false },
      ...(replyToMetaId ? { context: { message_id: replyToMetaId } } : {}),
    },
  });
  return { metaMessageId: data.messages?.[0]?.id || null, raw: data };
}

// Accusé de lecture (double coche bleue côté client).
export function markMessageAsRead(token, phoneNumberId, metaMessageId) {
  return graphRequest(`${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: { messaging_product: "whatsapp", status: "read", message_id: metaMessageId },
  });
}

// Média reçu : Meta donne d'abord une URL temporaire (≈ 5 min), à télécharger
// avec le MÊME jeton dans l'en-tête Authorization.
export function getMediaInfo(token, mediaId) {
  return graphRequest(mediaId, { token });
}

export async function downloadMedia(token, url, { timeoutMs = 60000, maxBytes = 100 * 1024 * 1024 } = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new GraphApiError(`Téléchargement du média impossible (${res.status})`, { status: res.status });
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) throw new GraphApiError("Média trop volumineux");
  return buffer;
}

// Image par lien public (brochure de programme). Meta télécharge l'image :
// l'URL doit être publique en HTTPS (pas localhost).
export async function sendImageMessage(token, phoneNumberId, to, link, caption) {
  const data = await graphRequest(`${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: { link, ...(caption ? { caption } : {}) },
    },
  });
  return { metaMessageId: data.messages?.[0]?.id || null, raw: data };
}

// Template approuvé par Meta — seul envoi possible quand la fenêtre de 24h
// est fermée. `components` au format Meta (paramètres de l'en-tête/du corps).
export async function sendTemplateMessage(token, phoneNumberId, to, name, languageCode, components = []) {
  const data = await graphRequest(`${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: { name, language: { code: languageCode }, ...(components.length ? { components } : {}) },
    },
  });
  return { metaMessageId: data.messages?.[0]?.id || null, raw: data };
}

// Liste des templates du compte WhatsApp Business (synchronisation).
export async function listMessageTemplates(token, wabaId) {
  const all = [];
  let path = `${wabaId}/message_templates?fields=id,name,language,status,category,components&limit=200`;
  for (let page = 0; page < 10 && path; page += 1) {
    const data = await graphRequest(path, { token });
    all.push(...(data.data || []));
    const next = data.paging?.next;
    path = next ? next.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "") : null;
  }
  return all;
}

// --- Gestion des templates (Lot 2) ------------------------------------------

// Création / soumission à Meta : body = { name, language, category, components }.
// Réponse : { id, status, category } (statut en général PENDING).
export function createMessageTemplate(token, wabaId, body) {
  return graphRequest(`${wabaId}/message_templates`, { token, method: "POST", body });
}

// Modification d'un template existant (refusé ou approuvé) : composants et/ou catégorie.
export function editMessageTemplate(token, metaTemplateId, body) {
  return graphRequest(metaTemplateId, { token, method: "POST", body });
}

// Suppression de toutes les langues d'un template, par son nom.
export function deleteMessageTemplate(token, wabaId, name) {
  return graphRequest(`${wabaId}/message_templates?name=${encodeURIComponent(name)}`, { token, method: "DELETE" });
}

// Échantillon d'en-tête média (image, document) exigé par Meta à la
// soumission d'un template : API d'envoi « reprenable » de l'application
// Meta (META_APP_ID). Renvoie le « handle » à placer dans example.header_handle.
// ⚠️ Écrit d'après la documentation Meta, non testé faute de compte.
export async function uploadTemplateSample(token, appId, { buffer, mimeType, fileName }) {
  if (!appId) throw new GraphApiError("META_APP_ID manquant : impossible d'envoyer l'exemple d'en-tête média");
  const session = await graphRequest(
    `${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${buffer.length}&file_type=${encodeURIComponent(mimeType)}`,
    { token, method: "POST" }
  );
  const res = await fetch(`${graphBase()}/${graphVersion()}/${session.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: buffer,
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.h) throw new GraphApiError(data.error?.message || "Envoi de l'exemple impossible", { status: res.status });
  return data.h;
}

// Message interactif (IA-12) : boutons de réponse (1 à 3) ou liste (jusqu'à 10).
export async function sendInteractiveMessage(token, phoneNumberId, to, { body, buttons = [], listButton = "Choisir", sections = null }) {
  const interactive =
    buttons.length > 0 && buttons.length <= 3 && !sections
      ? {
          type: "button",
          body: { text: body },
          action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
        }
      : {
          type: "list",
          body: { text: body },
          action: {
            button: listButton.slice(0, 20),
            sections: sections || [{ title: "Options", rows: buttons.slice(0, 10).map((b) => ({ id: b.id, title: b.title.slice(0, 24) })) }],
          },
        };
  const data = await graphRequest(`${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive", interactive },
  });
  return { metaMessageId: data.messages?.[0]?.id || null, raw: data };
}
