import crypto from "node:crypto";
import { query } from "./db";
import { getAgencyById } from "./agencies";
import { siteBaseUrl } from "./i18n/seo";

// IndexNow (TECH-17 du cahier des charges référencement, CLAUDE.md
// §3centquatorzequadragies) : chaque création/modification d'une page
// publique est signalée à Bing, Yandex... (Bing alimente aussi Copilot et la
// recherche de ChatGPT). Utilisé par le worker (file seo-indexnow) — aucun
// import de Next ici.
//
// Clé PROPRE À CHAQUE AGENCE (une agence = un domaine), dérivée par HMAC de
// SESSION_SECRET et du sous-domaine : rien à stocker en base, toujours la
// même. Servie par app/indexnow.txt/route.js et annoncée dans chaque envoi
// (keyLocation).

export function indexNowKeyFor(subdomain) {
  const secret = process.env.INDEXNOW_SECRET || process.env.SESSION_SECRET || "golden-fantastic";
  return crypto.createHmac("sha256", secret).update(`indexnow:${subdomain}`).digest("hex").slice(0, 32);
}

// Désactivé hors production et pour un hôte local (une clé invalide ou une
// URL localhost serait refusée de toute façon). INDEXNOW_ENDPOINT (faux
// serveur de test) l'active quel que soit l'environnement.
export function indexNowEnabledFor(baseUrl) {
  if (process.env.INDEXNOW_DISABLED === "1") return false;
  if (process.env.INDEXNOW_ENDPOINT) return true;
  if (process.env.NODE_ENV !== "production") return false;
  try {
    const host = new URL(baseUrl).hostname;
    return !(host === "localhost" || host.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host));
  } catch {
    return false;
  }
}

async function logPing(agencyId, urls, status, httpStatus, message) {
  await query(
    `INSERT INTO seo_indexnow_pings (agency_id, url_count, urls, status, http_status, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [agencyId, urls.length, JSON.stringify(urls.slice(0, 200)), status, httpStatus, message ? String(message).slice(0, 500) : null]
  );
}

// Envoie la liste d'URL de l'agence. Renvoie { status, httpStatus, message }.
// Lève une erreur seulement si un nouvel essai a du sens (réseau, 429, 5xx) :
// BullMQ réessaie alors la tâche.
export async function pingIndexNow(agencyId, urls) {
  const agency = await getAgencyById(agencyId);
  if (!agency) return { status: "ignore", message: "Agence introuvable" };
  const baseUrl = siteBaseUrl(agency.subdomain);
  const list = [...new Set(urls || [])].filter((u) => typeof u === "string" && u.startsWith(baseUrl)).slice(0, 10000);
  if (list.length === 0) return { status: "ignore", message: "Aucune URL de ce domaine" };

  if (!indexNowEnabledFor(baseUrl)) {
    await logPing(agencyId, list, "ignore", null, "IndexNow désactivé (hors production ou hôte local)");
    return { status: "ignore", message: "désactivé" };
  }

  const endpoint = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(baseUrl).host,
        key: indexNowKeyFor(agency.subdomain),
        keyLocation: `${baseUrl}/indexnow.txt`,
        urlList: list,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    await logPing(agencyId, list, "echec", null, `Réseau : ${err.message}`);
    throw err;
  }

  if (response.status === 200 || response.status === 202) {
    await logPing(agencyId, list, "envoye", response.status, null);
    return { status: "envoye", httpStatus: response.status };
  }
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  await logPing(agencyId, list, "echec", response.status, detail || response.statusText);
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`IndexNow HTTP ${response.status}`);
  }
  return { status: "echec", httpStatus: response.status, message: detail };
}

export async function listIndexNowPings(agencyId, limit = 50) {
  return query(
    `SELECT id, url_count, urls, status, http_status, message, created_at
     FROM seo_indexnow_pings WHERE agency_id = ?
     ORDER BY created_at DESC, id DESC LIMIT ${Number(limit) || 50}`,
    [agencyId]
  );
}
