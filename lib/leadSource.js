// Source des demandes (référencement, vague 1C — CLAUDE.md
// §3centseizequadragies). Fichier PUR (aucun import serveur) : partagé par
// le navigateur (mémorisation de la première visite, LeadSourceTracker) et
// le serveur (classement, qui seul fait foi : un client ne choisit jamais
// son canal, il n'envoie que les éléments bruts de sa première visite).

export const LEAD_SOURCE_STORAGE_KEY = "gf_lead_source";
export const LEAD_SOURCE_TTL_DAYS = 90;

// Canaux, dans l'ordre d'affichage du rapport (/admin/referencement).
export const LEAD_CHANNELS = [
  { key: "assistant_ia", label: "Assistant IA (ChatGPT, Perplexity...)" },
  { key: "moteur_recherche", label: "Moteur de recherche" },
  { key: "reseau_social", label: "Réseau social" },
  { key: "publicite", label: "Publicité" },
  { key: "campagne", label: "Campagne (lien suivi)" },
  { key: "site_referent", label: "Autre site" },
  { key: "direct", label: "Accès direct" },
  { key: "admin", label: "Saisie dans l'admin" },
];

export function leadChannelLabel(key) {
  if (!key) return "Non renseignée";
  return LEAD_CHANNELS.find((c) => c.key === key)?.label || key;
}

// Domaines reconnus (comparés au nom d'hôte du référent ou à utm_source).
// L'ordre compte : les assistants IA d'abord (gemini.google.com n'est pas
// le moteur Google).
const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "bard.google.com",
  "claude.ai",
  "copilot.microsoft.com",
  "chat.mistral.ai",
  "chat.deepseek.com",
  "deepseek.com",
  "meta.ai",
  "grok.com",
  "you.com",
  "poe.com",
];
const AI_SOURCES = ["chatgpt", "openai", "perplexity", "gemini", "claude", "copilot", "mistral", "deepseek", "meta.ai", "grok"];
const SEARCH_HOSTS = ["google.", "bing.com", "yahoo.", "duckduckgo.com", "yandex.", "ecosia.org", "baidu.com", "qwant.com", "search.brave.com"];
const SEARCH_SOURCES = ["google", "bing", "yahoo", "duckduckgo", "yandex", "ecosia", "qwant", "brave"];
const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "t.co",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "lnkd.in",
  "snapchat.com",
  "pinterest.",
  "telegram.org",
  "t.me",
  "whatsapp.com",
  "wa.me",
];
const SOCIAL_SOURCES = ["facebook", "fb", "instagram", "ig", "tiktok", "youtube", "twitter", "x", "linkedin", "snapchat", "pinterest", "telegram", "whatsapp"];
const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-social", "paid_social", "paidsocial", "cpm", "display", "ads", "ad", "banner", "sponsored"];
const SOCIAL_MEDIUMS = ["social", "social-network", "social_network", "sm", "organic_social"];

// Longueurs maximales conservées (rien d'autre n'est accepté du client).
const FIELD_LIMITS = {
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 150,
  utm_term: 150,
  utm_content: 150,
  gclid: 200,
  fbclid: 200,
  msclkid: 200,
  referrer: 300,
  landing_page: 300,
  first_visit: 30,
};

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, max) : null;
}

// Garde uniquement les clés connues, bornées (sécurité : le corps vient du
// navigateur). Renvoie null si rien d'exploitable.
export function sanitizeLeadDetails(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    const value = clip(raw[key], max);
    if (value) out[key] = value;
  }
  if (out.first_visit && Number.isNaN(Date.parse(out.first_visit))) delete out.first_visit;
  return Object.keys(out).length > 0 ? out : null;
}

export function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const hostMatches = (host, list) =>
  Boolean(host) && list.some((entry) => (entry.endsWith(".") ? host.startsWith(entry) || host.includes(`.${entry}`) : host === entry || host.endsWith(`.${entry}`)));

const sourceMatches = (source, list) =>
  Boolean(source) && list.some((entry) => source === entry || source.startsWith(`${entry}.`) || source.includes(entry));

// Canal d'une demande d'après la première visite. `ownHosts` : noms d'hôte
// du site lui-même (un référent interne n'est pas une source).
export function classifyLeadSource(details, { ownHosts = [] } = {}) {
  if (!details) return "direct";
  const source = (details.utm_source || "").toLowerCase();
  const medium = (details.utm_medium || "").toLowerCase();
  let host = hostOf(details.referrer);
  if (host && ownHosts.some((own) => host === own || host.endsWith(`.${own}`))) host = null;

  if (sourceMatches(source, AI_SOURCES) || hostMatches(host, AI_HOSTS)) return "assistant_ia";
  if (details.gclid || details.msclkid || details.fbclid || PAID_MEDIUMS.includes(medium)) return "publicite";
  if (SOCIAL_MEDIUMS.includes(medium) || (source && SOCIAL_SOURCES.includes(source)) || hostMatches(host, SOCIAL_HOSTS)) return "reseau_social";
  if (medium === "organic" || (source && SEARCH_SOURCES.includes(source)) || hostMatches(host, SEARCH_HOSTS)) return "moteur_recherche";
  if (source || medium || details.utm_campaign) return "campagne";
  if (host) return "site_referent";
  return "direct";
}

// --- Navigateur ---------------------------------------------------------

// Première visite mémorisée dans le stockage local (90 jours). Ne jamais
// lever d'erreur : stockage indisponible (navigation privée...) = rien.
export function readStoredLeadSource() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEAD_SOURCE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const firstVisit = Date.parse(data?.first_visit || "");
    if (!firstVisit || Date.now() - firstVisit > LEAD_SOURCE_TTL_DAYS * 86400000) {
      window.localStorage.removeItem(LEAD_SOURCE_STORAGE_KEY);
      return null;
    }
    return sanitizeLeadDetails(data);
  } catch {
    return null;
  }
}

// Enregistre la visite courante si aucune première visite n'est mémorisée
// (attribution au premier contact).
export function rememberFirstVisit() {
  if (typeof window === "undefined") return;
  try {
    if (readStoredLeadSource()) return;
    const params = new URLSearchParams(window.location.search);
    const details = {
      first_visit: new Date().toISOString(),
      landing_page: `${window.location.pathname}${window.location.search}`,
    };
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"]) {
      const value = params.get(key);
      if (value) details[key] = value;
    }
    const referrerHost = hostOf(document.referrer);
    if (referrerHost && referrerHost !== window.location.hostname.replace(/^www\./, "")) {
      details.referrer = document.referrer;
    }
    window.localStorage.setItem(LEAD_SOURCE_STORAGE_KEY, JSON.stringify(sanitizeLeadDetails(details)));
  } catch {
    // stockage local indisponible : la demande partira sans source (« direct »)
  }
}

// --- Serveur ------------------------------------------------------------

// Corps envoyé par un formulaire public → { leadSource, leadSourceDetails }
// prêts à enregistrer. `requestHost` : en-tête Host de la requête (un
// référent venant du site lui-même n'est pas une source).
export function resolveLeadSource(raw, requestHost) {
  const details = sanitizeLeadDetails(raw);
  const own = String(requestHost || "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return {
    leadSource: classifyLeadSource(details, { ownHosts: own ? [own] : [] }),
    leadSourceDetails: details,
  };
}

// Détail lisible d'une première visite (fiche inscription, messages).
// `details` : objet JSON stocké (ou texte selon la version de mysql2).
export function leadSourceFacts(details) {
  let data = details;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!data || typeof data !== "object") return [];
  const facts = [];
  const host = hostOf(data.referrer);
  if (host) facts.push({ label: "Site d'origine", value: host });
  const campaign = [data.utm_source, data.utm_medium, data.utm_campaign].filter(Boolean).join(" / ");
  if (campaign) facts.push({ label: "Campagne", value: campaign });
  if (data.landing_page) facts.push({ label: "Page d'arrivée", value: data.landing_page });
  if (data.first_visit) facts.push({ label: "Première visite", value: String(data.first_visit).slice(0, 10) });
  return facts;
}
