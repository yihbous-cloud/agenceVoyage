import Link from "next/link";
import { Geist, Geist_Mono, Italianno, Marcellus, Jost } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const italianno = Italianno({
  variable: "--font-italianno",
  subsets: ["latin"],
  weight: "400",
});

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata = {
  title: {
    default: "Golden Fantastic — Agence de voyages",
    template: "%s | Golden Fantastic",
  },
  description:
    "Golden Fantastic, agence de voyages spécialisée Omra, Hajj et séjours touristiques.",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "Golden Fantastic",
  description:
    "Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${italianno.variable} ${marcellus.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans text-zinc-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <header className="sticky top-0 z-50 border-b border-gold/30 bg-ink">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
            <Link href="/" className="font-script text-3xl leading-none text-gold">
              Golden Fantastic
            </Link>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-cream-card/90">
              <Link href="/omra-hajj" className="hover:text-gold">
                Omra &amp; Hajj
              </Link>
              <Link href="/voyages-organises" className="hover:text-gold">
                Voyages organisés
              </Link>
              <Link href="/a-propos" className="hover:text-gold">
                À propos
              </Link>
              <Link href="/actualites" className="hover:text-gold">
                Actualités
              </Link>
              <Link href="/faq" className="hover:text-gold">
                FAQ
              </Link>
              <Link href="/contact" className="hover:text-gold">
                Contact
              </Link>
              <Link
                href="/contact"
                className="bg-gold px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-gold-light"
              >
                Devis gratuit
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-gold/20 bg-ink-soft py-8 text-center text-sm text-cream-card/50">
          <p>
            © {new Date().getFullYear()} Golden Fantastic — Votre voyage, notre
            passion.
          </p>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <Link href="/mentions-legales" className="hover:text-gold">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-gold">
              Confidentialité
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
