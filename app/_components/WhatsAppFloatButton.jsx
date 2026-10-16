"use client";

import { trackEvent } from "@/lib/analytics";
import { useLocale } from "./LocaleProvider";

// Bouton WhatsApp flottant, en bas à droite de toutes les pages publiques
// (migration 049). Lien et message pré-rempli construits côté serveur
// (lib/contactLinks.js → siteButtonHref) ; réglages dans « Paramètres
// WhatsApp ». Côté droit dans toutes les langues (convention des boutons
// WhatsApp), au-dessus du contenu mais sous le bandeau de consentement.
export default function WhatsAppFloatButton({ href }) {
  const { locale, tr } = useLocale();
  if (!href) return null;
  const label = tr("Écrivez-nous sur WhatsApp");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={() => trackEvent("clic_whatsapp", { langue: locale, emplacement: "bouton_flottant" })}
      className="group fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/70 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] sm:right-6 sm:bottom-6"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-30 motion-reduce:hidden" aria-hidden="true" />
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.05.63C5.78.63.67 5.73.67 12.01c0 2 .52 3.96 1.52 5.69L.57 23.6l6.04-1.58a11.36 11.36 0 0 0 5.43 1.38h.01c6.27 0 11.38-5.1 11.38-11.38 0-3.04-1.18-5.9-3.33-8.05z" />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-ink px-3 py-1.5 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 sm:block">
        {label}
      </span>
    </a>
  );
}
