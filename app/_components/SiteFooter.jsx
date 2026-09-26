"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";

export default function SiteFooter() {
  const { dict } = useLocale();

  return (
    <footer className="border-t border-gold/20 bg-ink-soft px-4 py-8 text-center text-sm text-cream-card/50 sm:px-6">
      <p>
        © {new Date().getFullYear()} {dict.footer.copyright}
      </p>
      <div className="mt-2 flex flex-col items-center justify-center gap-2 text-xs sm:flex-row sm:gap-4">
        <Link href="/mentions-legales" className="hover:text-gold">
          {dict.footer.mentionsLegales}
        </Link>
        <Link href="/confidentialite" className="hover:text-gold">
          {dict.footer.confidentialite}
        </Link>
      </div>
    </footer>
  );
}
