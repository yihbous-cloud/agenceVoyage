"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "./LocalizedLink";
import { useLocale } from "./LocaleProvider";
import { rememberFirstVisit } from "@/lib/leadSource";
import { currentConsent, subscribeConsent, setConsent, loadGtm } from "@/lib/analytics";

// Référencement, vague 1C (CLAUDE.md §3centseizequadragies) :
//   - mémorise la première visite (source des demandes, stockage local) ;
//   - si l'agence a saisi un identifiant Google Tag Manager, affiche le
//     bandeau de consentement et ne charge GTM qu'après « Accepter ».
// Sans identifiant GTM : aucun bandeau, aucun script tiers.
export default function SiteAnalytics({ gtmId }) {
  useEffect(() => {
    rememberFirstVisit();
  }, []);

  if (!gtmId) return null;
  return <ConsentBanner gtmId={gtmId} />;
}

// Côté serveur (rendu statique), le choix du visiteur est inconnu : rien
// n'est affiché, le bandeau apparaît après hydratation s'il le faut.
const serverSnapshot = () => "unknown";

function ConsentBanner({ gtmId }) {
  const { tr } = useLocale();
  const consent = useSyncExternalStore(subscribeConsent, currentConsent, serverSnapshot);

  useEffect(() => {
    if (consent === "granted") loadGtm(gtmId);
  }, [consent, gtmId]);

  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label={tr("Cookies de mesure d'audience")}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-gold-pale bg-white p-4 text-sm text-ink shadow-lg sm:bottom-6"
    >
      <p className="leading-relaxed">
        {tr("Avec votre accord, nous mesurons l'audience du site (Google Analytics) pour l'améliorer. Aucun cookie publicitaire.")}{" "}
        <Link href="/confidentialite" className="text-[#A8863C] underline">
          {tr("En savoir plus")}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setConsent("denied")}
          className="min-w-28 border border-ink/30 px-4 py-2 text-xs font-medium tracking-wide uppercase hover:bg-cream"
        >
          {tr("Refuser")}
        </button>
        <button
          type="button"
          onClick={() => setConsent("granted")}
          className="min-w-28 border border-gold bg-gold px-4 py-2 text-xs font-medium tracking-wide text-ink uppercase hover:bg-gold-light"
        >
          {tr("Accepter")}
        </button>
      </div>
    </div>
  );
}
