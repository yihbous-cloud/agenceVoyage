import { getCurrentAgency } from "@/lib/currentAgency";
import { indexNowKeyFor } from "@/lib/indexNow";

// Fichier de clé IndexNow de l'agence (keyLocation annoncé dans chaque envoi,
// lib/indexNow.js) : prouve aux moteurs que le domaine est bien le nôtre.
// Multi-agences : une clé par sous-domaine, donc rendu à chaque requête.
export const dynamic = "force-dynamic";

export async function GET() {
  const { subdomain } = await getCurrentAgency();
  return new Response(indexNowKeyFor(subdomain), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
