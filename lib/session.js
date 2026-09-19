import { cookies, headers } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./auth";

// Multi-agences (CLAUDE.md §3sexvicies) : une session n'est valable que sur
// l'agence qui l'a émise. proxy.js pose x-agency-id (toujours écrasé, jamais
// pris tel quel du client) ; une session sans agencyId (émise avant la
// migration 016) ou d'une autre agence est traitée comme absente — défense
// en profondeur pour les routes API, que proxy.js ne filtre pas par session.
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const headerStore = await headers();
  const currentAgencyId = Number(headerStore.get("x-agency-id"));
  if (!currentAgencyId || Number(session.agencyId) !== currentAgencyId) return null;

  return session;
}

export async function getCurrentAgencyId() {
  const headerStore = await headers();
  return Number(headerStore.get("x-agency-id")) || null;
}
