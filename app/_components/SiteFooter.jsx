"use client";

import Link from "./LocalizedLink";
import { useLocale } from "./LocaleProvider";
import { NAV_LINKS } from "./navLinks";
import SocialIcon, { getSocialBrand } from "./SocialIcon";

// Couleur or utilisée pour le texte sur fond clair — même valeur que le
// reste du site public (HomeShowcaseCard.jsx, ProgramDetail.jsx,
// ReservationForm.jsx) : text-gold (plus clair) est réservé aux fonds
// sombres, cette teinte plus soutenue reste lisible sur blanc.
const GOLD_ON_LIGHT = "#A8863C";

// "Liens rapides" scindé en 2 groupes (demande explicite) — dérivés de
// NAV_LINKS (partagé avec SiteHeader.jsx) par simple filtre sur les clés,
// l'ordre d'origine de NAV_LINKS est préservé dans chaque groupe.
const QUICK_LINKS_GROUP_1_HREFS = ["/omra-hajj", "/voyages-organises", "/actualites"];
const QUICK_LINKS_GROUP_2_HREFS = ["/a-propos", "/faq", "/contact"];

// WhatsApp exige un numéro international sans "0" initial (wa.me) — les
// numéros saisis dans /admin/parametres sont au format marocain local
// ("0661..."), convertis ici en +212661... Repli sur les chiffres tels
// quels si le numéro est déjà international (commence par "+" ou ne
// commence pas par "0").
function whatsappHref(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const intl = digits.startsWith("+")
    ? digits.slice(1)
    : digits.startsWith("0")
      ? `212${digits.slice(1)}`
      : digits;
  return `https://wa.me/${intl}`;
}

// Convertit la couleur de marque (hex) en rgba() déjà résolu — plutôt que de
// passer un hex brut à un modificateur d'opacité Tailwind arbitraire sur une
// variable CSS (`bg-[var(--brand)]/10`), fragile selon la version de
// Tailwind. Chaque variable CSS ci-dessous contient donc directement une
// couleur CSS complète et valide, référencée telle quelle (`bg-[var(--x)]`).
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const value = parseInt(h, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Footer public — fond blanc (demande explicite, remplace le fond sombre
// d'origine), logo/infos agence, liens rapides (2 groupes), contact
// entièrement cliquable, réseaux sociaux aux couleurs de marque réelles.
// agency vient de agency_settings, chargé côté serveur dans
// app/(site)/layout.js et transmis en prop (ce composant reste "use
// client" pour useLocale, il ne peut pas interroger la base lui-même).
export default function SiteFooter({ agency }) {
  const { tr } = useLocale();
  const socialLinks = agency?.social_links || [];
  const addressLine = [agency?.address, agency?.city].filter(Boolean).join(", ");
  const quickLinksGroup1 = NAV_LINKS.filter((l) => QUICK_LINKS_GROUP_1_HREFS.includes(l.href));
  const quickLinksGroup2 = NAV_LINKS.filter((l) => QUICK_LINKS_GROUP_2_HREFS.includes(l.href));
  const hasContactInfo = addressLine || agency?.phone || agency?.whatsapp || agency?.email;

  return (
    <footer className="border-t border-gold-pale bg-white px-4 pt-12 pb-6 text-muted sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center">
              {agency?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agency.logo_url}
                  alt={agency?.name || "Golden Fantastic"}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span lang="en" className="font-script text-2xl leading-none" style={{ color: GOLD_ON_LIGHT }}>
                  {agency?.name || "Golden Fantastic"}
                </span>
              )}
            </Link>
            <p className="mt-3 text-sm text-muted">{tr("Golden Fantastic — Votre voyage, notre passion.")}</p>

            {socialLinks.length > 0 && (
              <div className="mt-4">
                <p
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: GOLD_ON_LIGHT }}
                >
                  {tr("Suivez-nous")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {socialLinks.map((link) => {
                    const brand = getSocialBrand(link.platform);
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.platform}
                        title={link.platform}
                        style={{
                          "--brand-solid": brand.color,
                          "--brand-tint": hexToRgba(brand.color, 0.12),
                          "--brand-border": hexToRgba(brand.color, 0.35),
                        }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand-solid)] transition-colors hover:bg-[var(--brand-solid)] ${
                          brand.dark ? "hover:text-ink" : "hover:text-white"
                        }`}
                      >
                        <SocialIcon platform={link.platform} className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: GOLD_ON_LIGHT }}>
              {tr("Liens rapides")}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {quickLinksGroup1.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-[#A8863C]">
                  {tr(link.label)}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: GOLD_ON_LIGHT }}>
              {tr("Informations")}
            </h3>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              {quickLinksGroup2.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-[#A8863C]">
                  {tr(link.label)}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: GOLD_ON_LIGHT }}>
              {tr("Contact")}
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {hasContactInfo ? (
                <>
                  {addressLine && <p>{addressLine}</p>}
                  {agency?.phone && (
                    <a href={`tel:${agency.phone.replace(/\s+/g, "")}`} className="hover:text-[#A8863C]">
                      {agency.phone}
                    </a>
                  )}
                  {agency?.whatsapp && (
                    <a
                      href={whatsappHref(agency.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#A8863C]"
                    >
                      {tr("WhatsApp")} : {agency.whatsapp}
                    </a>
                  )}
                  {agency?.email && (
                    <a href={`mailto:${agency.email}`} className="hover:text-[#A8863C]">
                      {agency.email}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted/60">
                  {"["}{tr("à compléter dans /admin/parametres")}{"]"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-gold-pale pt-6 text-center text-xs text-muted sm:flex-row sm:justify-between sm:text-start">
          <p>
            © {new Date().getFullYear()} {tr("Golden Fantastic — Votre voyage, notre passion.")}
          </p>
          {/* Mention de droits : exploitant de la plateforme, identique pour
              toutes les agences — sur la même ligne que le copyright. */}
          <p>
            {tr("Tous droits réservés")} —{" "}
            <span dir="ltr" translate="no" className="font-medium text-ink">
              STE BUSINESS KEEPER
            </span>{" "}
            <a
              href="tel:0661327686"
              dir="ltr"
              className="whitespace-nowrap hover:text-[#A8863C]"
            >
              (0661327686)
            </a>
          </p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-[#A8863C]">
              {tr("Mentions légales")}
            </Link>
            <Link href="/confidentialite" className="hover:text-[#A8863C]">
              {tr("Confidentialité")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
