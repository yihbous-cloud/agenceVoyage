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

export function resolveSubdomainFromHost(hostHeader) {
  if (!hostHeader) return null;

  const host = hostHeader.split(":")[0].toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

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
