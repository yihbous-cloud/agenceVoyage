"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { localizePath } from "@/lib/i18n/locales";

// Drop-in de next/link pour le site public : les chemins internes
// ("/omra-hajj") reçoivent automatiquement le préfixe de la langue courante
// ("/fr/omra-hajj"), l'arabe (langue par défaut) n'en a pas. Liens
// externes, ancres (#), tel:/mailto: et chemins déjà préfixés restent tels
// quels.
export default function LocalizedLink({ href, ...props }) {
  const { locale } = useLocale();
  const isInternalPath =
    typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
  const alreadyLocalized = isInternalPath && /^\/(ar|fr|en)(\/|$|\?|#)/.test(href);
  const finalHref = isInternalPath && !alreadyLocalized ? localizePath(href, locale) : href;
  return <Link href={finalHref} {...props} />;
}
