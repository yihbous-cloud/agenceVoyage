import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans text-zinc-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold text-emerald-700">
              Golden Fantastic
            </Link>
            <nav className="flex flex-wrap gap-5 text-sm font-medium text-zinc-600">
              <Link href="/omra-hajj" className="hover:text-emerald-700">
                Omra &amp; Hajj
              </Link>
              <Link href="/voyages-organises" className="hover:text-emerald-700">
                Voyages organisés
              </Link>
              <Link href="/a-propos" className="hover:text-emerald-700">
                À propos
              </Link>
              <Link href="/actualites" className="hover:text-emerald-700">
                Actualités
              </Link>
              <Link href="/faq" className="hover:text-emerald-700">
                FAQ
              </Link>
              <Link href="/contact" className="hover:text-emerald-700">
                Contact
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
          <p>© {new Date().getFullYear()} Golden Fantastic</p>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <Link href="/mentions-legales" className="hover:text-emerald-700">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-emerald-700">
              Confidentialité
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
