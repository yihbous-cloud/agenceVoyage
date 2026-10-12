import { revalidatePath } from "next/cache";
import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { getAgencyById } from "./agencies";
import { SUPPORTED_LOCALES, INDEXED_LOCALES, localizePath } from "./i18n/locales";
import { siteBaseUrl } from "./i18n/seo";
import { programPath, pillarPath } from "./programUrls";
import { enqueue, QUEUES } from "./queue";

// Mise à jour IMMÉDIATE des pages publiques après une modification dans
// l'admin (TECH-02 du cahier des charges référencement, CLAUDE.md
// §3centquatorzequadragies), puis signalement IndexNow (file seo-indexnow,
// exécutée par le worker).
//
// Les pages publiques sont rendues sous un chemin INTERNE réécrit par
// proxy.js : /<sous-domaine>/<langue>/... (l'arabe garde /ar en interne
// alors que son URL visible n'a pas de préfixe). Next 16 impose de revalider
// ce chemin réécrit (doc revalidatePath, « rewrites »), pas l'URL visible.
// Les motifs (toutes les agences) doivent inclure le groupe (site).
//
// À appeler APRÈS un enregistrement réussi, depuis une route API. Ne lève
// JAMAIS d'erreur : une revalidation ratée ne doit pas faire échouer
// l'enregistrement (l'ISR de 5 min prend de toute façon le relais).

const SITE_LAYOUT_PATTERN = "/(site)/[agency]/[locale]";

function internalPath(subdomain, locale, path) {
  return `/${subdomain}/${locale}${path === "/" ? "" : path}`;
}

async function programIdsFor(scope, agencyId) {
  const ids = new Set();
  if (scope.programId) ids.add(Number(scope.programId));
  (scope.programIds || []).forEach((id) => ids.add(Number(id)));
  if (scope.tripId) {
    const rows = await query(`SELECT program_id FROM trips WHERE id = ? AND agency_id = ?`, [scope.tripId, agencyId]);
    rows.forEach((r) => ids.add(r.program_id));
  }
  if (scope.tierId) {
    const rows = await query(
      `SELECT t.program_id FROM trip_hotel_tiers tht
       JOIN trips t ON t.id = tht.trip_id
       WHERE tht.id = ? AND tht.agency_id = ? AND t.agency_id = ?`,
      [scope.tierId, agencyId, agencyId]
    );
    rows.forEach((r) => ids.add(r.program_id));
  }
  if (scope.tripHotelId) {
    const rows = await query(
      `SELECT t.program_id FROM trip_hotels th
       JOIN trips t ON t.id = th.trip_id
       WHERE th.id = ? AND th.agency_id = ? AND t.agency_id = ?`,
      [scope.tripHotelId, agencyId, agencyId]
    );
    rows.forEach((r) => ids.add(r.program_id));
  }
  if (scope.faqId) {
    const rows = await query(`SELECT program_id FROM program_faqs WHERE id = ? AND agency_id = ?`, [scope.faqId, agencyId]);
    rows.forEach((r) => ids.add(r.program_id));
  }
  if (scope.mealOfferId) {
    const rows = await query(
      `SELECT t.program_id FROM trip_meal_offers mo
       JOIN trips t ON t.id = mo.trip_id
       WHERE mo.id = ? AND mo.agency_id = ? AND t.agency_id = ?`,
      [scope.mealOfferId, agencyId, agencyId]
    );
    rows.forEach((r) => ids.add(r.program_id));
  }
  return [...ids].filter(Boolean);
}

// Programme(s) concerné(s) par une ressource, à lire AVANT une suppression
// (après, la ligne n'existe plus) : passer ensuite { programIds } à
// refreshPublicPages. Ne lève jamais d'erreur.
export async function findProgramIds(scope = {}) {
  try {
    const agencyId = await resolveAgencyId(scope.agencyId);
    return await programIdsFor(scope, agencyId);
  } catch {
    return [];
  }
}

// scope :
//   { programId | programIds | tripId | tierId | tripHotelId | faqId |
//     mealOfferId }                              — fiche, pilier, accueil
//   { previousPaths: [...] }                     — anciennes URL (slug changé)
//   { newsSlug, previousNewsSlug }               — article, /actualites, accueil
//   { paths: [...] }                             — chemins publics précis
//   { site: true }                               — tout le site de l'agence
//                                                  (paramètres, hôtels...)
//   { agencyId }                                 — sinon agence de la requête
export async function refreshPublicPages(scope = {}) {
  try {
    const agencyId = await resolveAgencyId(scope.agencyId);
    const agency = await getAgencyById(agencyId);
    if (!agency) return;

    const paths = new Set(scope.paths || []);
    (scope.previousPaths || []).filter(Boolean).forEach((p) => paths.add(p));

    const programIds = await programIdsFor(scope, agencyId);
    if (programIds.length > 0) {
      const placeholders = programIds.map(() => "?").join(", ");
      const programs = await query(
        `SELECT id, slug, family, program_type FROM programs WHERE id IN (${placeholders}) AND agency_id = ?`,
        [...programIds, agencyId]
      );
      for (const program of programs) {
        paths.add(programPath(program));
        paths.add(pillarPath(program));
      }
      paths.add("/");
    }

    if (scope.newsSlug || scope.previousNewsSlug) {
      if (scope.newsSlug) paths.add(`/actualites/${scope.newsSlug}`);
      if (scope.previousNewsSlug) paths.add(`/actualites/${scope.previousNewsSlug}`);
      paths.add("/actualites");
      paths.add("/");
    }

    if (scope.site) {
      // Paramètres de l'agence, hôtels, compagnies : visibles sur un grand
      // nombre de pages — tout le site public est régénéré à la prochaine
      // visite de chaque page.
      revalidatePath(SITE_LAYOUT_PATTERN, "layout");
    } else {
      for (const path of paths) {
        for (const locale of SUPPORTED_LOCALES) {
          revalidatePath(internalPath(agency.subdomain, locale, path));
        }
      }
    }

    // IndexNow : seulement les langues indexées (l'anglais est hors index).
    const baseUrl = siteBaseUrl(agency.subdomain);
    const urls = [...paths].flatMap((path) =>
      INDEXED_LOCALES.map((locale) => `${baseUrl}${localizePath(path, locale)}`)
    );
    if (urls.length > 0) {
      await enqueue(QUEUES.seo, "ping", { agencyId, urls });
    }
  } catch (err) {
    console.warn(`[revalidation] pages publiques non rafraîchies : ${err.message}`);
  }
}
