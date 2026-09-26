import { Geist, Geist_Mono, Italianno, Marcellus, Jost } from "next/font/google";
import { getAgencySettings } from "@/lib/agencySettings";
import { LocaleProvider } from "@/app/_components/LocaleProvider";
import SiteHeader from "@/app/_components/SiteHeader";
import SiteFooter from "@/app/_components/SiteFooter";
import "../globals.css";

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
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

// LocalBusiness n'est ajouté que si l'adresse/téléphone réels de l'agence
// sont renseignés (agency_settings, saisis depuis /admin/parametres) — pas
// de coordonnées inventées (voir CLAUDE.md §3quinquies/§7).
function buildOrganizationJsonLd(agency) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "Golden Fantastic",
    description:
      "Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
    url: baseUrl,
  };

  if (agency?.address && agency?.phone) {
    jsonLd["@type"] = ["TravelAgency", "LocalBusiness"];
    jsonLd.telephone = agency.phone.split("/")[0].trim();
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: agency.address,
      addressLocality: agency.city || undefined,
      addressCountry: "MA",
    };
    if (agency.email) jsonLd.email = agency.email;
  }

  return jsonLd;
}

// Layout racine du site public — indépendant de app/admin/layout.js (voir
// celui-ci). Les deux sont des "root layouts" distincts (route group
// (site) ci-contre) : l'espace interne n'hérite plus du header/footer
// marketing, qui ne doit apparaître que sur les pages publiques.
//
// lang/dir restent fr/ltr en dur ici (rendu serveur, statique/ISR préservé
// — voir CLAUDE.md) : LocaleProvider corrige les deux côté client une fois
// monté, selon le cookie de langue choisi par LanguageSwitcher. Lire ce
// cookie ici (cookies() de next/headers) forcerait tout l'arbre de rendu
// en dynamique et ferait perdre le rendu statique/ISR de toutes les pages
// publiques — testé et rejeté pendant l'implémentation.
export default async function SiteLayout({ children }) {
  const agency = await getAgencySettings().catch(() => null);
  const organizationJsonLd = buildOrganizationJsonLd(agency);

  return (
    <html
      lang="fr"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} ${italianno.variable} ${marcellus.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream font-sans text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <LocaleProvider>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
