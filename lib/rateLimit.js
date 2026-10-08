import { getRedis } from "./queue";

// Limitation de débit des API publiques et de la connexion (NF-10).
// Fenêtre fixe dans Redis (INCR + EXPIRE). Si Redis ne répond pas, la
// requête passe (le service public ne doit pas tomber avec Redis) et un
// avertissement est journalisé.

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "inconnue").trim();
}

export async function rateLimit(key, { limit, windowSeconds }) {
  try {
    const redis = getRedis();
    const full = `gf:rl:${key}`;
    const count = await Promise.race([
      redis.incr(full),
      new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), 800)),
    ]);
    if (count === 1) await redis.expire(full, windowSeconds);
    return { ok: count <= limit, count, limit };
  } catch (err) {
    console.warn(`[rate-limit] contrôle impossible (${err.message}) : requête acceptée`);
    return { ok: true, count: 0, limit };
  }
}

// Réponse 429 standard.
export function tooManyRequests(NextResponse, retryAfterSeconds = 60) {
  return NextResponse.json(
    { message: "Trop de requêtes. Merci de réessayer dans quelques instants." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
