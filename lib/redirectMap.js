import { query } from "./db";
import { stripLocalePrefix } from "./i18n/locales";

// Redirections 301 publiques (CLAUDE.md §3centquatorzequadragies, table
// `redirects`) — partie LUE PAR proxy.js. Volontairement sans
// lib/agencyContext.js (qui importe next/headers) : l'agence est passée
// explicitement. La gestion (création, aplatissement des chaînes, admin) est
// dans lib/redirects.js.
//
// Les chemins sont stockés SANS préfixe de langue : un slug est commun à
// toutes les langues, une seule ligne redirige donc /x, /fr/x et /en/x.

// Chemin public normalisé : préfixe de langue retiré, query/ancre retirées,
// slash final retiré, caractères encodés décodés. Accepte aussi une URL
// complète (seul son chemin est gardé). null si vide ou illisible.
export function normalizeRedirectPath(input) {
  let value = String(input ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  value = value.split(/[?#]/)[0];
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/{2,}/g, "/");
  try {
    value = decodeURI(value);
  } catch {
    // Séquence % invalide : on garde le chemin tel quel.
  }
  const { path } = stripLocalePrefix(value);
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed || "/";
}

// Cible : URL absolue https (externe, gardée telle quelle) ou chemin interne
// normalisé comme ci-dessus.
export function normalizeRedirectTarget(input) {
  const value = String(input ?? "").trim();
  if (/^https:\/\//i.test(value)) return value;
  return normalizeRedirectPath(value);
}

export function isExternalTarget(target) {
  return /^https?:\/\//i.test(target || "");
}

// Carte { from_path → { to, status } } d'une agence, mise en cache dans le
// module APPELANT (le proxy a son propre exemplaire de ce module : Next
// l'exécute séparément du rendu, voir docs « proxy ») — durée de vie courte
// pour qu'une redirection créée dans l'admin s'applique en moins d'une minute.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

export async function getRedirectMap(agencyId) {
  const hit = cache.get(agencyId);
  if (hit && hit.expiresAt > Date.now()) return hit.map;
  const rows = await query(
    `SELECT from_path, to_path, status_code FROM redirects WHERE agency_id = ?`,
    [agencyId]
  );
  const map = new Map(rows.map((r) => [r.from_path, { to: r.to_path, status: r.status_code }]));
  cache.set(agencyId, { map, expiresAt: Date.now() + CACHE_TTL_MS });
  return map;
}

// Compteur d'utilisation (affiché dans l'admin) — appelé sans attendre la
// réponse, jamais bloquant pour le visiteur redirigé.
export function recordRedirectHit(agencyId, fromPath) {
  query(
    `UPDATE redirects SET hits = hits + 1, last_hit_at = NOW() WHERE agency_id = ? AND from_path = ?`,
    [agencyId, fromPath]
  ).catch(() => {});
}
