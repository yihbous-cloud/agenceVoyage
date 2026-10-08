import { notFound } from "next/navigation";
import { getAgencyBySubdomain } from "./agencies";

// Pages publiques statiques/ISR (multi-agences, CLAUDE.md §3sexvicies passe
// 2) : l'agence vient du segment d'URL [agency] — que proxy.js réécrit depuis
// le sous-domaine de la requête — et NON d'un en-tête : lire headers() rendrait
// toutes ces pages dynamiques et leur ferait perdre leur cache ISR. Un
// sous-domaine inconnu ou inactif est un 404.
export async function requirePublicAgency(subdomain) {
  const agency = await getAgencyBySubdomain(String(subdomain || ""));
  if (!agency) notFound();
  return agency;
}
