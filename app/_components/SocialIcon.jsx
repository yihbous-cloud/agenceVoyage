// Icônes réseaux sociaux — SVG à la main, comme le reste du projet (aucune
// dépendance icône ajoutée, voir CLAUDE.md, ex. le hamburger de SiteHeader).
// La plateforme reste un texte libre (agency_social_links.platform,
// §social-links) : les noms courants ci-dessous obtiennent une icône
// dédiée, reconnue insensible à la casse/aux espaces ; toute autre valeur
// retombe sur une icône générique (lien) plutôt que de rien afficher — un
// nouveau réseau social ajouté par l'agence reste donc toujours utilisable.
const ICONS = {
  facebook: (
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </>
  ),
  tiktok: (
    <>
      <circle cx="9" cy="17" r="3.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12.2 3v13.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path
        d="M12.2 3c.4 3 2.8 5.3 5.8 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  youtube: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M10 9l6 3-6 3V9z" fill="currentColor" />
    </>
  ),
  x: <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  twitter: <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="8" cy="8.5" r="1.3" fill="currentColor" />
      <path
        d="M8 11v6M12 11v6M12 13.6c0-1.5 1-2.6 2.3-2.6S17 12.1 17 13.6V17"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  whatsapp: (
    <>
      <path
        d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.7-1.23A9 9 0 1 0 12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M8.5 9.5c.3 3 2.7 5.4 5.7 5.7l1-1.4-2-1-.8.8a5 5 0 0 1-2.3-2.3l.8-.8-1-2-1.4 1z"
        fill="currentColor"
      />
    </>
  ),
  snapchat: (
    <path
      d="M12 3c-3 0-5 2.3-5 5.3v2.2c-.7.5-1.5 1-2.3 1.2-.4.1-.4.7 0 .9.7.4 1.6.7 2.3.9.1.8.4 1.6.9 2.2-.3.6-.9 1-1.6 1.3-.4.2-.3.8.1.9 1 .3 2 .2 2.7-.1.5.5 1.2.8 1.9.8s1.4-.3 1.9-.8c.7.3 1.7.4 2.7.1.4-.1.5-.7.1-.9-.7-.3-1.3-.7-1.6-1.3.5-.6.8-1.4.9-2.2.7-.2 1.6-.5 2.3-.9.4-.2.4-.8 0-.9-.8-.2-1.6-.7-2.3-1.2V8.3C17 5.3 15 3 12 3z"
      fill="currentColor"
    />
  ),
  pinterest: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M10.2 17.3c.3-1.2.9-3.7.9-3.7s-.2-.5-.2-1.2c0-1.2.7-2 1.6-2 .7 0 1.1.5 1.1 1.2 0 .7-.5 1.8-.7 2.8-.2.9.4 1.6 1.3 1.6 1.5 0 2.7-1.6 2.7-3.9 0-2-1.5-3.5-3.6-3.5-2.5 0-3.9 1.8-3.9 3.7 0 .7.3 1.5.6 1.9.1.1.1.2.1.3l-.3.9c0 .2-.2.2-.3.1-.9-.4-1.5-1.6-1.5-2.7 0-2.2 1.6-4.2 4.6-4.2 2.4 0 4.3 1.7 4.3 4 0 2.4-1.5 4.3-3.6 4.3-.7 0-1.4-.4-1.6-.8l-.5 1.7c-.2.7-.5 1.4-.8 1.9"
        fill="currentColor"
      />
    </>
  ),
  telegram: (
    <path
      d="M21 4L3 11l6 2 2 6 2-3 4 3 4-15z"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
      strokeLinejoin="round"
    />
  ),
  googlemaps: (
    <>
      <path
        d="M12 21s-7-6.6-7-11.3A7 7 0 1 1 19 9.7C19 14.4 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
      />
      <circle cx="12" cy="9.7" r="2.4" fill="currentColor" />
    </>
  ),
};

const GENERIC = (
  <>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
    <path d="M3 12h18" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <path
      d="M12 3c2.3 2.4 3.3 5.8 3.3 9s-1 6.6-3.3 9c-2.3-2.4-3.3-5.8-3.3-9s1-6.6 3.3-9z"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
    />
  </>
);

// Couleurs de marque de chaque réseau — demande explicite ("les couleurs
// réelles de chaque icône"). `dark: true` = fond de marque trop clair pour
// une icône blanche au survol (Snapchat), bascule sur l'encre du projet.
const BRAND_COLORS = {
  facebook: { color: "#1877F2" },
  instagram: { color: "#E1306C" },
  tiktok: { color: "#010101" },
  youtube: { color: "#FF0000" },
  x: { color: "#000000" },
  twitter: { color: "#1DA1F2" },
  linkedin: { color: "#0A66C2" },
  whatsapp: { color: "#25D366" },
  snapchat: { color: "#FFFC00", dark: true },
  pinterest: { color: "#E60023" },
  telegram: { color: "#229ED9" },
  googlemaps: { color: "#EA4335" },
};

// Repli doré du projet pour toute plateforme non reconnue par BRAND_COLORS —
// jamais de couleur "cassée"/par défaut du navigateur.
const DEFAULT_BRAND_COLOR = "#A8863C";

export function getSocialBrand(platform) {
  return BRAND_COLORS[normalize(platform)] || { color: DEFAULT_BRAND_COLOR };
}

function normalize(platform) {
  return (platform || "").trim().toLowerCase().replace(/\s+/g, "");
}

export default function SocialIcon({ platform, className = "h-4 w-4" }) {
  const content = ICONS[normalize(platform)] || GENERIC;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {content}
    </svg>
  );
}
