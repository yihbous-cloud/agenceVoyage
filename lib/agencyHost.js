// Résolution du sous-domaine d'agence depuis l'en-tête Host (multi-agences,
// voir CLAUDE.md §3sexvicies). Fonction pure, sans accès DB — importable
// depuis proxy.js et testable isolément.
//
// - Production : le domaine racine est configuré via ROOT_DOMAIN (ex.
//   "golden-plateforme.ma") ; "agence1.golden-plateforme.ma" → "agence1".
//   Le domaine n'étant pas encore choisi (CLAUDE.md §7), rien n'est codé en dur.
// - Développement : "agence1.localhost:3000" → "agence1" (les navigateurs
//   résolvent *.localhost vers la boucle locale sans configuration) ; un
//   simple "localhost"/adresse IP retombe sur DEV_AGENCY_SUBDOMAIN, ou
//   "goldenfantastic" hors production pour ne pas casser le flux existant.
//   En production, aucun repli silencieux : pas de correspondance → null.

const IP_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

// Domaines propres aux agences (ex. "goldenfantastic.com" pour l'agence
// historique) : AGENCY_DOMAINS="goldenfantastic.com=goldenfantastic,autre.ma=agence2".
// Prioritaires sur ROOT_DOMAIN ; "www." est ignoré (Nginx redirige déjà www
// vers le domaine nu, ceci n'est qu'un filet).
function parseAgencyDomains() {
  const map = new Map();
  for (const entry of (process.env.AGENCY_DOMAINS || "").split(",")) {
    const [domain, subdomain] = entry.split("=").map((v) => v?.trim().toLowerCase());
    if (domain && subdomain) map.set(domain.replace(/^www\./, ""), subdomain);
  }
  return map;
}

// Domaine propre d'une agence (sans protocole), ou null.
export function agencyDomainFor(subdomain) {
  if (!subdomain) return null;
  for (const [domain, sub] of parseAgencyDomains()) {
    if (sub === subdomain.toLowerCase()) return domain;
  }
  return null;
}

export function resolveSubdomainFromHost(hostHeader) {
  if (!hostHeader) return null;

  const host = hostHeader.split(":")[0].toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

  const ownDomain = parseAgencyDomains().get(host.replace(/^www\./, ""));
  if (ownDomain) return ownDomain;

  const rootDomain = process.env.ROOT_DOMAIN?.toLowerCase();
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const sub = host.slice(0, -(rootDomain.length + 1));
    return sub && !sub.includes(".") ? sub : null;
  }

  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return sub && !sub.includes(".") ? sub : null;
  }

  if (host === "localhost" || IP_PATTERN.test(host)) {
    if (process.env.DEV_AGENCY_SUBDOMAIN) return process.env.DEV_AGENCY_SUBDOMAIN;
    return isProduction ? null : "goldenfantastic";
  }

  return null;
}
