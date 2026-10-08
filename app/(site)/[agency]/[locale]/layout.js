import { notFound } from "next/navigation";
import { listAgencies } from "@/lib/agencies";
import { requirePublicAgency } from "@/lib/publicAgency";
import { Geist, Geist_Mono, Italianno, Marcellus, Jost, Cairo } from "next/font/google";
import { getAgencySettings } from "@/lib/agencySettings";
import { LocaleProvider } from "@/app/_components/LocaleProvider";
import SiteHeader from "@/app/_components/SiteHeader";
import SiteFooter from "@/app/_components/SiteFooter";
import { SUPPORTED_LOCALES, isValidLocale, isRtl } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";
import { siteBaseUrl } from "@/lib/i18n/seo";
import "../../../globals.css";

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

// Police arabe (Geist/Italianno/Marcellus/Jost n'ont pas de glyphes arabes) —
// appliquée via html[lang="ar"] dans globals.css.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Multi-agences (CLAUDE.md §3sexvicies passe 2) : proxy.js réécrit chaque URL
// publique en /<sous-domaine-agence>/<langue>/..., les pages restent donc
// statiques/ISR (l'agence vient de l'URL). Une page par agence active ET par
// langue est pré-générée ; une agence créée après le build est rendue à la
// première visite puis mise en cache (dynamicParams par défaut). Une langue
// ou une agence inconnue est un 404 (validé ci-dessous). L'arabe est la
// langue principale : sans préfixe dans l'URL visible, le français et
// l'anglais sont préfixés.
export async function generateStaticParams() {
  const agencies = await listAgencies().catch(() => []);
  return agencies
    .filter((a) => a.is_active)
    .flatMap((a) => SUPPORTED_LOCALES.map((locale) => ({ agency: a.subdomain, locale })));
}

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const agencyRow = await requirePublicAgency(subdomain);
  const brand = agencyRow.name;
  const tr = makeTranslator(locale, "public", { brandName: brand });
  return {
    metadataBase: new URL(siteBaseUrl(subdomain)),
    title: {
      default: `${brand} — ${tr("Agence de voyages")}`,
      template: `%s | ${brand}`,
    },
    description: tr(
      "Golden Fantastic, agence de voyages spécialisée Omra, Hajj et séjours touristiques."
    ),
    alternates: {
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
  };
}

// LocalBusiness n'est ajouté que si l'adresse/téléphone réels de l'agence
// sont renseignés (agency_settings, saisis depuis /admin/parametres) — pas
// de coordonnées inventées (voir CLAUDE.md §3quinquies/§7).
function buildOrganizationJsonLd(agency, tr, baseUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: agency?.name || "Golden Fantastic",
    description: tr(
      "Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques."
    ),
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
// lang/dir viennent de la langue de l'URL (segment [locale]) : le HTML
// serveur est déjà dans la bonne langue et la bonne direction (SEO, pas de
// "flash" après hydratation).
export default async function SiteLayout({ children, params }) {
  const { agency: subdomain, locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const agencyRow = await requirePublicAgency(subdomain);

  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const agency = await getAgencySettings(agencyRow.id).catch(() => null);
  const organizationJsonLd = buildOrganizationJsonLd(agency, tr, siteBaseUrl(subdomain));

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${italianno.variable} ${marcellus.variable} ${jost.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream font-sans text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <LocaleProvider locale={locale} brandName={agencyRow.name}>
          <SiteHeader agencyName={agencyRow.name} />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter agency={agency} />
        </LocaleProvider>
      </body>
    </html>
  );
}
