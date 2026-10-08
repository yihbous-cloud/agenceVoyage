"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "./LocalizedLink";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "./LocaleProvider";
import { NAV_LINKS } from "./navLinks";

// Seuil lg: (1024px) : logo + 6 liens + CTA + sélecteur de langue = 9
// éléments, ne tient plus confortablement avant ce seuil (voir CLAUDE.md).
export default function SiteHeader({ agencyName = "Golden Fantastic" }) {
  const { tr } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-gold/30 bg-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" lang="en" className="font-script text-2xl leading-none text-gold sm:text-3xl">
          {agencyName}
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-cream-card/90 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-gold">
              {tr(link.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/contact"
            className="hidden bg-gold px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-gold-light sm:inline-block"
          >
            {tr("Devis gratuit")}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={isOpen ? tr("Fermer") : tr("Menu")}
            className="flex h-9 w-9 items-center justify-center text-cream-card lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <nav
          id="mobile-nav-drawer"
          className="flex flex-col gap-1 border-t border-gold/20 bg-ink px-4 py-3 lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded px-2 py-2.5 text-sm text-cream-card/90 hover:bg-white/5 hover:text-gold"
            >
              {tr(link.label)}
            </Link>
          ))}
          <Link
            href="/contact"
            className="mt-2 bg-gold px-5 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-ink hover:bg-gold-light"
          >
            {tr("Devis gratuit")}
          </Link>
        </nav>
      )}
    </header>
  );
}
