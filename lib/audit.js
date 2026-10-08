import { query } from "./db";

// Journal d'audit (table audit_log, migration 037) : qui a changé quoi, quand,
// avec l'état avant/après. Ne JAMAIS y passer un secret en clair — masquer
// avant (voir maskSecret, lib/secrets.js). Une écriture d'audit qui échoue ne
// doit pas faire échouer l'action elle-même : l'erreur est seulement loggée.
export async function logAudit({ agencyId, staffId = null, action, objectType, objectId = null, before = null, after = null, ip = null }) {
  try {
    await query(
      `INSERT INTO audit_log (agency_id, staff_id, action, object_type, object_id, before_json, after_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agencyId,
        staffId,
        action,
        objectType,
        objectId == null ? null : String(objectId),
        before == null ? null : JSON.stringify(before),
        after == null ? null : JSON.stringify(after),
        ip,
      ]
    );
  } catch (err) {
    console.error("[audit] écriture impossible :", err.message);
  }
}

export function requestIp(request) {
  const fwd = request?.headers?.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : request?.headers?.get("x-real-ip")) || null;
}
