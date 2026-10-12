import {
  DEFAULT_LOCALE,
  INDEXED_LOCALES,
  HREFLANG_TAGS,
  OG_LOCALES,
  localizePath,
} from "./locales";
import { agencyDomainFor } from "../agencyHost";

// Balises canonical + <link rel="alternate" hreflang> d'une page publique
// (chemins relatifs : résolus contre metadataBase, voir le layout). `path`
// est le chemin SANS préfixe de langue ("/omra"). Seules les langues
// indexées (arabe, français — l'anglais en est exclu, CLAUDE.md
// §3centtreizequadragies) sont annoncées, en codes marocains (ar-MA, fr-MA) ;
// x-default pointe vers la langue principale (arabe).
//
// `contentLocale` (optionnel) : langue RÉELLE d'un contenu saisi en base dans
// une seule langue (lib/i18n/contentLocale.js). Toutes les versions pointent
// alors leur canonical vers celle-ci et aucun hreflang n'est émis — sinon
// Google verrait /fr/x et /x comme deux doublons du même texte.
export function pageAlternates(locale, path, { contentLocale } = {}) {
  if (contentLocale && INDEXED_LOCALES.includes(contentLocale)) {
    return { canonical: localizePath(path, contentLocale) };
  }
  const languages = Object.fromEntries(
    INDEXED_LOCALES.map((l) => [HREFLANG_TAGS[l], localizePath(path, l)])
  );
  languages["x-default"] = localizePath(path, DEFAULT_LOCALE);
  return { canonical: localizePath(path, locale), languages };
}

// Balises Open Graph + Twitter d'une page (aperçus de liens WhatsApp,
// Facebook...). Next REMPLACE l'objet openGraph du parent au lieu de le
// fusionner : chaque page qui définit le sien doit donc tout redonner, d'où
// cet assembleur unique. `url` : l'URL canonique de la page (déjà localisée,
// relative) ; `image` : chemin relatif ou URL (résolu contre metadataBase),
// repli sur le logo de l'agence.
export function buildSocialMetadata({ locale, siteName, title, description, url, image, logoUrl, type = "website" }) {
  const imageUrl = image || logoUrl || null;
  const openGraph = {
    siteName,
    locale: OG_LOCALES[locale] || OG_LOCALES[DEFAULT_LOCALE],
    type,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(url ? { url } : {}),
    ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
  };
  const twitter = {
    card: image ? "summary_large_image" : "summary",
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { images: [imageUrl] } : {}),
  };
  return { openGraph, twitter };
}

// URL publique d'une agence (multi-agences, une agence = un sous-domaine) :
//   - domaine propre déclaré dans AGENCY_DOMAINS : https://<domaine>
//   - ROOT_DOMAIN défini : https://<sous-domaine>.<ROOT_DOMAIN>
//   - sinon, l'agence historique/de développement : NEXT_PUBLIC_SITE_URL
//   - sinon (autre agence en développement) : http://<sous-domaine>.localhost:3000
export function siteBaseUrl(subdomain) {
  const ownDomain = agencyDomainFor(subdomain);
  if (ownDomain) return `https://${ownDomain}`;
  const rootDomain = process.env.ROOT_DOMAIN;
  if (subdomain && rootDomain) return `https://${subdomain}.${rootDomain}`;
  const defaultSubdomain = process.env.DEV_AGENCY_SUBDOMAIN || "goldenfantastic";
  if (!subdomain || subdomain === defaultSubdomain) {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  }
  return `http://${subdomain}.localhost:3000`;
}
