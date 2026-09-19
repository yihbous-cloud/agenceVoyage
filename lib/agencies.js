import { query } from "./db";

// Multi-agences (voir CLAUDE.md §3sexvicies). Lecture seule dans cette
// passe : une nouvelle agence se crée via scripts/create-agency.js, pas via
// l'interface.

// Cache mémoire par sous-domaine — proxy.js résout l'agence à CHAQUE requête,
// et les docs Next 16 déconseillent les accès lents dans proxy. Une agence
// inconnue est aussi mise en cache (durée plus courte) pour qu'un hôte
// invalide ne martèle pas la base.
const FOUND_TTL_MS = 5 * 60 * 1000;
const MISSING_TTL_MS = 30 * 1000;
const cache = new Map();

export async function getAgencyBySubdomain(subdomain) {
  const key = subdomain.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.agency;

  const rows = await query(
    `SELECT * FROM agencies WHERE subdomain = ? AND is_active = TRUE LIMIT 1`,
    [key]
  );
  const agency = rows[0] || null;
  cache.set(key, {
    agency,
    expiresAt: Date.now() + (agency ? FOUND_TTL_MS : MISSING_TTL_MS),
  });
  return agency;
}

export async function getAgencyById(id) {
  const rows = await query(`SELECT * FROM agencies WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function listAgencies() {
  return query(`SELECT * FROM agencies ORDER BY id ASC`);
}

export function clearAgencyCache() {
  cache.clear();
}
