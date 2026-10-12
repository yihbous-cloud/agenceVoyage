"use client";

import Link from "@/app/_components/LocalizedLink";
import { useLocale } from "@/app/_components/LocaleProvider";

// Page 404 du site public (TECH-15 du cahier des charges référencement) :
// rendue dans le layout de l'agence (en-tête, pied de page, langue), avec un
// vrai code HTTP 404 — y compris pour une URL qui ne correspond à aucune page
// (route attrape-tout [...introuvable]). not-found.js ne reçoit pas les
// paramètres de route : la langue vient du LocaleProvider du layout.
// Les pages 404 ne sont pas indexées (Next ajoute noindex).
const LINKS = [
  { href: "/omra", label: "Omra" },
  { href: "/hajj", label: "Hajj" },
  { href: "/voyages-organises", label: "Voyages organisés" },
  { href: "/contact", label: "Contact" },
];

export default function PublicNotFound() {
  const { tr } = useLocale();

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-cream px-6 py-20 text-center">
      <p className="font-script text-7xl leading-none text-gold">404</p>
      <h1 className="mt-4 font-display text-2xl font-normal text-ink sm:text-3xl">
        {tr("Page introuvable")}
      </h1>
      <p className="mt-3 max-w-md text-muted">
        {tr("Cette page n'existe pas ou n'est plus disponible. Nos programmes en cours sont accessibles ci-dessous.")}
      </p>
      <nav className="mt-8 flex flex-wrap justify-center gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border border-gold px-6 py-3 text-xs tracking-widest text-[#A8863C] uppercase transition-colors hover:bg-gold hover:text-ink"
          >
            {tr(link.label)}
          </Link>
        ))}
      </nav>
      <Link href="/" className="mt-6 text-sm text-muted hover:text-ink">
        {tr("Retour à l'accueil")}
      </Link>
    </main>
  );
}
