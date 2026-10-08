import { SUPPORTED_LOCALES, DEFAULT_LOCALE, localizePath } from "./locales";

// Balises <link rel="alternate" hreflang> + canonical d'une page publique
// (chemins relatifs : résolus contre metadataBase, voir le layout). `path`
// est le chemin SANS préfixe de langue ("/omra-hajj"). x-default pointe vers
// la langue principale (arabe).
export function pageAlternates(locale, path) {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((l) => [l, localizePath(path, l)])
  );
  languages["x-default"] = localizePath(path, DEFAULT_LOCALE);
  return { canonical: localizePath(path, locale), languages };
}

// URL publique d'une agence (multi-agences, une agence = un sous-domaine) :
//   - ROOT_DOMAIN défini : https://<sous-domaine>.<ROOT_DOMAIN>
//   - sinon, l'agence historique/de développement : NEXT_PUBLIC_SITE_URL
//   - sinon (autre agence en développement) : http://<sous-domaine>.localhost:3000
export function siteBaseUrl(subdomain) {
  const rootDomain = process.env.ROOT_DOMAIN;
  if (subdomain && rootDomain) return `https://${subdomain}.${rootDomain}`;
  const defaultSubdomain = process.env.DEV_AGENCY_SUBDOMAIN || "goldenfantastic";
  if (!subdomain || subdomain === defaultSubdomain) {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  }
  return `http://${subdomain}.localhost:3000`;
}
