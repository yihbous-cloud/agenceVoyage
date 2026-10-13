import { notFound } from "next/navigation";
import { listAgencies } from "@/lib/agencies";
import { requirePublicAgency } from "@/lib/publicAgency";
import { Geist, Geist_Mono, Italianno, Marcellus, Jost, Cairo } from "next/font/google";
import { getAgencySettings } from "@/lib/agencySettings";
import { LocaleProvider } from "@/app/_components/LocaleProvider";
import SiteHeader from "@/app/_components/SiteHeader";
import SiteFooter from "@/app/_components/SiteFooter";
import SiteAnalytics from "@/app/_components/SiteAnalytics";
import { SUPPORTED_LOCALES, isValidLocale, isRtl, isIndexedLocale } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";
import { siteBaseUrl, buildSocialMetadata } from "@/lib/i18n/seo";
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
  const description = tr(
    "Golden Fantastic, agence de voyages spécialisée Omra, Hajj et séjours touristiques."
  );
  return {
    metadataBase: new URL(siteBaseUrl(subdomain)),
    title: {
      default: `${brand} — ${tr("Agence de voyages")}`,
      template: `%s | ${brand}`,
    },
    description,
    alternates: {
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
    // Anglais accessible aux visiteurs mais hors index tant que le contenu
    // n'est pas traduit (CLAUDE.md §3centtreizequadragies, décision D1).
    ...(isIndexedLocale(locale) ? {} : { robots: { index: false, follow: true } }),
    // Aperçus de liens (WhatsApp, Facebook...) : valeurs par défaut, chaque
    // page importante redonne les siennes (buildSocialMetadata).
    ...buildSocialMetadata({ locale, siteName: brand, description, logoUrl: agencyRow.logo_url }),
    // Icône = logo de l'agence (multi-agences), plus l'icône Next.js par défaut.
    ...(agencyRow.logo_url
      ? { icons: { icon: agencyRow.logo_url, apple: agencyRow.logo_url } }
      : {}),
  };
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

  // Le balisage schema.org (organisation, site...) n'est plus produit ici :
  // chaque page a UN SEUL bloc JSON-LD qui l'inclut (PageJsonLd,
  // CLAUDE.md §3centquatorzequadragies).
  const agency = await getAgencySettings(agencyRow.id).catch(() => null);
  // Le pied de page est un composant client : seulement ce qu'il affiche
  // (pas les CGV complètes ni les autres champs légaux).
  const footerAgency = agency && {
    name: agency.name,
    logo_url: agency.logo_url,
    address: agency.address,
    city: agency.city,
    phone: agency.phone,
    whatsapp: agency.whatsapp,
    email: agency.email,
    social_links: agency.social_links,
    has_cgv: Boolean(agency.cgv_fr?.trim() || agency.cgv_ar?.trim()),
    analytics_enabled: Boolean(agency.gtm_container_id),
  };

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${italianno.variable} ${marcellus.variable} ${jost.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream font-sans text-ink">
        <LocaleProvider locale={locale} brandName={agencyRow.name}>
          <SiteHeader agencyName={agencyRow.name} />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter agency={footerAgency} />
          <SiteAnalytics gtmId={agency?.gtm_container_id || null} />
        </LocaleProvider>
      </body>
    </html>
  );
}
