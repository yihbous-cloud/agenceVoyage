// Mesure d'audience (GA4 via Google Tag Manager) — référencement, vague 1C
// (CLAUDE.md §3centseizequadragies). Fichier pour le NAVIGATEUR uniquement.
//
// Rien n'est chargé ni posé tant que l'agence n'a pas saisi d'identifiant
// GTM (/admin/parametres), puis tant que le visiteur n'a pas accepté :
// Google Tag Manager n'est chargé qu'après « Accepter » (mode de
// consentement v2, refus par défaut). Les événements ne partent qu'après
// acceptation.

const CONSENT_KEY = "gf_consent";
const CONSENT_MAX_AGE_DAYS = 395; // 13 mois, puis la question est reposée

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

// "granted" | "denied" | null (pas encore de choix)
export function readConsent() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw);
    if (!["granted", "denied"].includes(value)) return null;
    if (!Date.parse(at) || Date.now() - Date.parse(at) > CONSENT_MAX_AGE_DAYS * 86400000) return null;
    return value;
  } catch {
    return null;
  }
}

export function subscribeConsent(listener) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function gtag() {
  window.dataLayer = window.dataLayer || [];
  // Les commandes de consentement doivent être poussées sous forme
  // d'objet `arguments` (format gtag).
  window.dataLayer.push(arguments);
}

export function setConsent(value) {
  window.__gfConsentFallback = value || null;
  try {
    if (value) window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // stockage indisponible : le choix vaut pour cette page seulement
    // (__gfConsentFallback)
  }
  if (value === "denied" && window.__gfGtmLoaded) {
    gtag("consent", "update", { analytics_storage: "denied" });
  }
  notify();
}

// « Gérer les cookies » : efface le choix pour réafficher le bandeau.
export function resetConsent() {
  setConsent(null);
}

// Charge GTM une seule fois, après acceptation.
export function loadGtm(containerId) {
  if (typeof window === "undefined" || !containerId) return;
  if (window.__gfGtmLoaded) {
    // Refus puis nouvelle acceptation sur la même page.
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  window.__gfGtmLoaded = true;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("consent", "update", { analytics_storage: "granted" });
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(script);
}

// Choix courant (stockage local, sinon choix fait sur cette page).
export function currentConsent() {
  if (typeof window === "undefined") return null;
  return readConsent() ?? window.__gfConsentFallback ?? null;
}

function consentGranted() {
  return currentConsent() === "granted";
}

// Événement de conversion : clic_whatsapp, clic_telephone, demande_devis,
// reservation. Ne fait rien sans GTM chargé et consentement.
export function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || !window.__gfGtmLoaded || !consentGranted()) return;
  window.dataLayer.push({
    event: name,
    page: window.location.pathname,
    ...params,
  });
}
