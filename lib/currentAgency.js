import { resolveAgencyId } from "./agencyContext";
import { getAgencyById } from "./agencies";
import { siteBaseUrl } from "./i18n/seo";

// Agence de la requête courante (en-tête x-agency-id posé par proxy.js) avec
// son URL publique — pour les routes DYNAMIQUES par nature (sitemap, robots,
// llms.txt, flux RSS, API publique) qui ne sont de toute façon pas
// pré-générées. Les pages statiques/ISR n'utilisent PAS ceci : elles lisent
// l'agence dans le segment d'URL [agency] (lib/publicAgency.js).
export async function getCurrentAgency() {
  const id = await resolveAgencyId();
  const agency = await getAgencyById(id);
  if (!agency) throw new Error("Agence introuvable");
  return { id: agency.id, name: agency.name, subdomain: agency.subdomain, baseUrl: siteBaseUrl(agency.subdomain) };
}
