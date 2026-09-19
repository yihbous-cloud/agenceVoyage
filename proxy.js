import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getAgencyBySubdomain } from "@/lib/agencies";
import { resolveSubdomainFromHost } from "@/lib/agencyHost";

// Ancien middleware.js (déprécié depuis Next 16, voir docs "proxy") —
// désormais aussi chargé de résoudre l'agence depuis le sous-domaine
// (multi-agences, CLAUDE.md §3sexvicies) et de la transmettre aux pages/API
// via l'en-tête interne x-agency-id. Aucune requête DB hors cache mémoire
// (lib/agencies.js) : les docs déconseillent les accès lents dans proxy.
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const subdomain = resolveSubdomainFromHost(request.headers.get("host"));
  const agency = subdomain ? await getAgencyBySubdomain(subdomain) : null;
  if (!agency) {
    return new NextResponse("Agence introuvable", { status: 404 });
  }

  // x-agency-id est TOUJOURS écrasé ici : une valeur envoyée par le client ne
  // doit jamais être prise pour argent comptant par les pages/API en aval.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-agency-id", String(agency.id));
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (!pathname.startsWith("/admin")) return pass();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = token ? await verifySessionToken(token) : null;
  // Une session émise par une autre agence (ou avant la migration 016, sans
  // agencyId) est traitée comme absente sur ce sous-domaine.
  const session = verified && Number(verified.agencyId) === agency.id ? verified : null;

  if (pathname.startsWith("/admin/login")) {
    if (session) {
      const next = request.nextUrl.searchParams.get("next") || "/admin";
      return NextResponse.redirect(new URL(next, request.url));
    }
    return pass();
  }

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return pass();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
