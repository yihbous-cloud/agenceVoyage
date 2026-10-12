import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { normalizeRedirectPath, normalizeRedirectTarget, isExternalTarget } from "./redirectMap";

// Gestion des redirections 301 publiques (CLAUDE.md §3centquatorzequadragies) :
// créées à la main depuis /admin/referencement, ou automatiquement quand une
// URL publique change (slug, pilier), est dépubliée ou supprimée. La lecture
// par le proxy est dans lib/redirectMap.js.
//
// Règles :
//   - jamais de chaîne : A→B alors que B→C existe enregistre A→C, et toute
//     redirection qui pointait vers A est repointée vers la cible finale —
//     un visiteur ne fait toujours qu'un seul saut ;
//   - jamais de boucle (A→A, ou une cible qui ramène à A) ;
//   - un contenu vivant l'emporte : removeRedirectsFrom() est appelé dès
//     qu'une page existe à nouveau à un chemin redirigé.

export const REDIRECT_SOURCES = ["manuel", "auto_slug", "auto_depublication", "auto_suppression"];

// Chemins jamais redirigeables (espace interne, API, fichiers techniques,
// accueil).
const FORBIDDEN_FROM = /^\/(admin|api|_next|uploads)(\/|$)/;

function invalid(message) {
  const err = new Error(message);
  err.code = "INVALID_REDIRECT";
  return err;
}

// Cible finale en suivant les redirections existantes (10 sauts au plus).
async function resolveFinalTarget(agencyId, target, fromPath) {
  let current = target;
  for (let i = 0; i < 10 && !isExternalTarget(current); i++) {
    if (current === fromPath) throw invalid("Cette redirection créerait une boucle.");
    const rows = await query(
      `SELECT to_path FROM redirects WHERE agency_id = ? AND from_path = ? LIMIT 1`,
      [agencyId, current]
    );
    if (rows.length === 0) return current;
    current = rows[0].to_path;
  }
  if (current === fromPath) throw invalid("Cette redirection créerait une boucle.");
  return current;
}

// Crée (ou remplace) la redirection fromPath → toPath. Renvoie la ligne
// enregistrée { from_path, to_path } (cible aplatie).
// `repointChains` (par défaut oui) : les redirections qui menaient à
// fromPath sont repointées vers la cible finale. Désactivé pour une
// DÉPUBLICATION, souvent temporaire : à la republication, la redirection de
// la fiche est retirée et les anciennes adresses qui y menaient retrouvent
// leur destination (au prix de deux sauts tant que la fiche est dépubliée).
export async function createRedirect(
  { fromPath, toPath, source = "manuel", staffId = null, repointChains = true },
  explicitAgencyId
) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const from = normalizeRedirectPath(fromPath);
  const to = normalizeRedirectTarget(toPath);
  if (!from || from === "/") throw invalid("Le chemin d'origine est invalide (l'accueil ne peut pas être redirigé).");
  if (FORBIDDEN_FROM.test(from)) throw invalid("Ce chemin ne peut pas être redirigé.");
  if (!to) throw invalid("La destination est invalide (chemin /... ou URL https://...).");
  if (!REDIRECT_SOURCES.includes(source)) throw invalid("Origine de redirection inconnue.");

  const finalTarget = await resolveFinalTarget(agencyId, to, from);
  if (finalTarget === from) throw invalid("Cette redirection créerait une boucle.");

  await query(
    `INSERT INTO redirects (agency_id, from_path, to_path, status_code, source, created_by_staff_id)
     VALUES (?, ?, ?, 301, ?, ?)
     ON DUPLICATE KEY UPDATE to_path = VALUES(to_path), source = VALUES(source),
       created_by_staff_id = VALUES(created_by_staff_id)`,
    [agencyId, from, finalTarget, source, staffId]
  );
  // Ce qui pointait vers `from` pointe désormais directement vers la cible
  // finale (un seul saut pour le visiteur).
  if (repointChains) {
    await query(
      `UPDATE redirects SET to_path = ? WHERE agency_id = ? AND to_path = ? AND from_path <> ?`,
      [finalTarget, agencyId, from, finalTarget]
    );
  }
  // Une éventuelle redirection qui pointerait désormais vers elle-même
  // (X→from alors que X est la cible finale) est supprimée.
  await query(`DELETE FROM redirects WHERE agency_id = ? AND from_path = to_path`, [agencyId]);
  return { from_path: from, to_path: finalTarget };
}

// Un contenu vivant l'emporte sur une redirection : à appeler quand une page
// (re)devient accessible à ces chemins (republication, nouveau slug repris).
export async function removeRedirectsFrom(paths, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const normalized = [...new Set((paths || []).map(normalizeRedirectPath).filter(Boolean))];
  if (normalized.length === 0) return;
  const placeholders = normalized.map(() => "?").join(", ");
  await query(
    `DELETE FROM redirects WHERE agency_id = ? AND from_path IN (${placeholders})`,
    [agencyId, ...normalized]
  );
}

// Redirections automatiques d'un contenu public (programme, actualité) après
// un enregistrement, selon son chemin et son état publié avant/après :
//   - publié après : son chemin redevient vivant (on retire toute redirection
//     qui le masquerait) ; si le chemin a changé (slug, pilier), l'ancien
//     redirige vers le nouveau ;
//   - dépublié : le chemin (et l'ancien s'il a changé) redirige vers
//     `fallbackPath` (le pilier, ou /actualites) — jamais de 404 pour une
//     page déjà connue des moteurs ; la republication annule la redirection.
// Ne lève jamais d'erreur : une redirection manquée ne doit pas faire échouer
// l'enregistrement. Renvoie les chemins devenus obsolètes (à revalider).
export async function syncContentRedirects({
  beforePath,
  afterPath,
  beforePublished,
  afterPublished,
  fallbackPath,
  staffId = null,
  agencyId,
}) {
  const stale = [];
  try {
    if (afterPublished) {
      await removeRedirectsFrom([afterPath], agencyId);
      if (beforePath && beforePath !== afterPath) {
        await createRedirect({ fromPath: beforePath, toPath: afterPath, source: "auto_slug", staffId }, agencyId);
        stale.push(beforePath);
      }
    } else if (beforePublished) {
      await createRedirect(
        { fromPath: afterPath, toPath: fallbackPath, source: "auto_depublication", staffId, repointChains: false },
        agencyId
      );
      stale.push(afterPath);
      if (beforePath && beforePath !== afterPath) {
        await createRedirect({ fromPath: beforePath, toPath: fallbackPath, source: "auto_depublication", staffId }, agencyId);
        stale.push(beforePath);
      }
    }
  } catch (err) {
    console.warn(`[redirections] synchronisation impossible : ${err.message}`);
  }
  return stale;
}

// Suppression définitive d'un contenu publié : son URL redirige vers
// `fallbackPath` (TECH-09 du cahier des charges).
export async function redirectDeletedContent({ path, fallbackPath, staffId = null, agencyId }) {
  try {
    await createRedirect({ fromPath: path, toPath: fallbackPath, source: "auto_suppression", staffId }, agencyId);
  } catch (err) {
    console.warn(`[redirections] redirection après suppression impossible : ${err.message}`);
  }
}

export async function listRedirects(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT r.id, r.from_path, r.to_path, r.status_code, r.source, r.hits, r.last_hit_at, r.created_at,
            su.full_name AS created_by_name
     FROM redirects r
     LEFT JOIN staff_users su ON su.id = r.created_by_staff_id
     WHERE r.agency_id = ?
     ORDER BY r.created_at DESC, r.id DESC`,
    [agencyId]
  );
}

export async function deleteRedirect(id, explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned("redirects", id, agencyId);
  await query(`DELETE FROM redirects WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
