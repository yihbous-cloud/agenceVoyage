import {
  DEFAULT_LOCALE,
  INDEXED_LOCALES,
  HREFLANG_TAGS,
  OG_LOCALES,
  localizePath,
} from "./locales";
import { agencyDomainFor } from "../agencyHost";

// Longueur maximale d'un titre dans les résultats Google (même seuil que
// scripts/seo-check.mjs). Le gabarit du layout public ajoute « | <agence> » :
// quand le titre complet dépasserait ce seuil (nom d'agence long), le titre
// est rendu seul ({ absolute }) — Google affiche de toute façon le nom du
// site au-dessus du titre.
export const TITLE_MAX = 60;

export function brandedTitle(title, brand, max = TITLE_MAX) {
  const full = brand ? `${title} | ${brand}` : title;
  return [...full].length > max ? { absolute: title } : title;
}

// Balises canonical + <link rel="alternate" hreflang> d'une page publique
// (chemins relatifs : résolus contre metadataBase, voir le layout). `path`
// est le chemin SANS préfixe de langue ("/omra"). Seules les langues
// indexées (arabe, français — l'anglais en est exclu, CLAUDE.md
// §3centtreizequadragies) sont annoncées, en codes marocains (ar-MA, fr-MA) ;
// x-default pointe vers la langue principale (arabe).
//
// `availableLocales` (optionnel) : langues dans lesquelles un contenu saisi
// en base existe réellement (programme, actualité — vague 1B, CLAUDE.md
// §3centquinzequadragies ; langue principale en tête). Une page affichée
// dans une langue où le contenu n'existe pas montre la version principale :
// sa canonical pointe vers celle-ci, sans hreflang (sinon Google verrait
// /fr/x et /x comme deux doublons du même texte). Les hreflang ne listent
// que les langues disponibles, et seulement s'il y en a plusieurs.
export function pageAlternates(locale, path, { availableLocales } = {}) {
  const available = availableLocales
    ? INDEXED_LOCALES.filter((l) => availableLocales.includes(l))
    : INDEXED_LOCALES;
  if (available.length === 0) return { canonical: localizePath(path, locale) };
  if (!available.includes(locale)) {
    const principal = (availableLocales || []).find((l) => available.includes(l)) || available[0];
    return { canonical: localizePath(path, principal) };
  }
  if (available.length < 2) return { canonical: localizePath(path, locale) };
  const languages = Object.fromEntries(available.map((l) => [HREFLANG_TAGS[l], localizePath(path, l)]));
  languages["x-default"] = localizePath(path, available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : available[0]);
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
