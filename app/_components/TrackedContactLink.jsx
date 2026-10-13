"use client";

import { trackEvent } from "@/lib/analytics";
import { useLocale } from "./LocaleProvider";

// Lien WhatsApp / téléphone / email du site public. Un clic WhatsApp ou
// téléphone envoie l'événement de conversion correspondant (clic_whatsapp,
// clic_telephone) — seulement si la mesure d'audience est activée et
// acceptée (lib/analytics.js). `href` est construit par lib/contactLinks.js.
export default function TrackedContactLink({ kind, href, tripRef, className, children, ...rest }) {
  const { locale } = useLocale();
  if (!href) return children ?? null;

  const event = kind === "whatsapp" ? "clic_whatsapp" : kind === "phone" ? "clic_telephone" : null;
  const external = kind === "whatsapp";

  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => {
        if (event) trackEvent(event, { langue: locale, ...(tripRef ? { voyage: tripRef } : {}) });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
