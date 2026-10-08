import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getAgencyBySubdomain } from "@/lib/agencies";
import { resolveSubdomainFromHost } from "@/lib/agencyHost";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

// Chemins qui ne sont PAS des pages publiques localisées (ni /admin, qui a
// sa propre langue par cookie) : API, flux et fichiers servis tels quels.
const NON_LOCALIZED = /^\/(api|admin|uploads|_next)(\/|$)|^\/(feed\.xml|llms\.txt|sitemap\.xml|robots\.txt|favicon\.ico)$|\.[a-zA-Z0-9]+$/;

// Ancien middleware.js (déprécié depuis Next 16, voir docs "proxy") —
// désormais aussi chargé de résoudre l'agence depuis le sous-domaine
// (multi-agences, CLAUDE.md §3sexvicies) et de la transmettre aux pages/API
// via l'en-tête interne x-agency-id. Aucune requête DB hors cache mémoire
// (lib/agencies.js) : les docs déconseillent les accès lents dans proxy.
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Webhooks externes (Meta WhatsApp, passerelles de paiement) : UNE URL
  // commune à toutes les agences, appelée depuis le domaine racine — pas de
  // sous-domaine à résoudre. La route retrouve elle-même l'agence dans le
  // contenu signé (ex. phone_number_id). x-agency-id est retiré : une valeur
  // fournie par l'appelant ne doit jamais être prise en compte.
  if (pathname.startsWith("/api/webhooks/")) {
    const webhookHeaders = new Headers(request.headers);
    webhookHeaders.delete("x-agency-id");
    return NextResponse.next({ request: { headers: webhookHeaders } });
  }

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

  // Double authentification obligatoire (NF-07) : une session ouverte par un
  // rôle soumis à la 2FA qui ne l'a pas encore activée ne peut appeler QUE
  // l'API de sécurité (activation) — toutes les autres API admin sont refusées.
  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/security")) {
    const apiToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const apiSession = apiToken ? await verifySessionToken(apiToken) : null;
    if (apiSession?.mfaSetupRequired && Number(apiSession.agencyId) === agency.id) {
      return NextResponse.json({ message: "Activez d'abord la double authentification (page Sécurité)." }, { status: 403 });
    }
  }

  if (!pathname.startsWith("/admin")) {
    if (NON_LOCALIZED.test(pathname)) return pass();

    // Arabe = langue principale, sans préfixe : "/ar/x" redirige (308) vers
    // "/x" pour qu'une page n'ait qu'une seule URL canonique par langue.
    if (/^\/ar(\/|$)/.test(pathname)) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.replace(/^\/ar/, "") || "/";
      return NextResponse.redirect(target, 308);
    }

    // Multi-agences : les pages publiques vivent sous app/(site)/[agency]/
    // [locale]/... — l'agence (sous-domaine de la requête) devient le premier
    // segment du chemin INTERNE, jamais visible dans l'URL du navigateur.
    // Ainsi les pages restent statiques/ISR (l'agence vient de l'URL, pas d'un
    // en-tête dynamique). TOUT chemin public est réécrit ici : un client ne
    // peut pas atteindre /<autre-agence>/... en le tapant (il serait lui-même
    // préfixé par SON sous-domaine et ne correspondrait à aucune page).
    const rewritten = request.nextUrl.clone();
    if (/^\/(fr|en)(\/|$)/.test(pathname)) {
      // /fr/... et /en/... : langue explicite
      rewritten.pathname = `/${agency.subdomain}${pathname}`;
    } else {
      // Pas de préfixe = langue par défaut : réécriture interne vers /ar/...
      // (l'URL affichée dans le navigateur ne change pas).
      rewritten.pathname = `/${agency.subdomain}/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
    }
    return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = token ? await verifySessionToken(token) : null;
  // Une session émise par une autre agence (ou avant la migration 016, sans
  // agencyId) est traitée comme absente sur ce sous-domaine.
  const session = verified && Number(verified.agencyId) === agency.id ? verified : null;

  // Connexion et demande de compte (migration 041) : seules pages /admin
  // accessibles sans session ; une session déjà ouverte est renvoyée vers
  // l'espace interne.
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/demande-compte")) {
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

  if (session.mfaSetupRequired && !pathname.startsWith("/admin/securite")) {
    return NextResponse.redirect(new URL("/admin/securite", request.url));
  }

  return pass();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
