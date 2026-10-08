import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Kufi_Arabic } from "next/font/google";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCurrentAgency } from "@/lib/currentAgency";
import { countActiveRegistrations } from "@/lib/registrations";
import { countPendingSignupRequests } from "@/lib/staffUsers";
import { countPendingForStaff } from "@/lib/whatsapp/conversations";
import { getAgencySettings } from "@/lib/agencySettings";
import AdminShell from "./_components/AdminShell";
import { ADMIN_ICON_NAMES } from "./_components/Icon";
import { AdminLocaleProvider } from "./_components/AdminLocale";
import AdminLanguageSwitcher from "./_components/AdminLanguageSwitcher";
import { makeTranslator } from "@/lib/i18n/translate";
import { LOCALE_COOKIE_NAME, resolveLocale, isRtl } from "@/lib/i18n/locales";
import "../globals.css";
import "./admin-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police arabe de la charte admin (designadmin.md) : Noto Kufi Arabic, en
// complément de Geist (qui n'a pas de glyphes arabes) — voir admin-theme.css.
const kufi = Noto_Kufi_Arabic({
  variable: "--font-kufi",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});


// Langue de l'espace interne : cookie (partagé avec le sélecteur du site
// public), arabe par défaut — l'espace interne est dynamique (session), lire
// le cookie ici ne coûte aucun rendu statique.
async function getAdminLocale() {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE_NAME)?.value);
}

export async function generateMetadata() {
  const agency = await getCurrentAgency();
  const tr = makeTranslator(await getAdminLocale(), "admin", { brandName: agency.name });
  return {
    title: {
      default: `${tr("Espace interne")} | ${agency.name}`,
      template: `%s | ${tr("Espace interne")}`,
    },
    robots: { index: false, follow: false },
  };
}

// Navigation groupée (charte designadmin.md) : chaque entrée porte son icône
// Material Symbols. `perm` : lien affiché seulement si la permission est
// accordée (une liste : au moins une) ; un groupe vide n'est pas affiché.
const NAV_GROUPS = [
  {
    label: "Général",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: "space_dashboard" },
      { href: "/admin/inscriptions", label: "Inscrits", icon: "group", badgeKey: "registrations" },
      { href: "/admin/programmes", label: "Programmes", icon: "travel_explore" },
      { href: "/admin/hotels", label: "Hôtels", icon: "hotel" },
    ],
  },
  {
    label: "Visa & voyages",
    items: [
      { href: "/admin/visa-types", label: "Types de visa", icon: "badge" },
      { href: "/admin/visa-services", label: "Service visa", icon: "assignment", perm: "visa_services.manage" },
      { href: "/admin/billets", label: "Billets d'avion", icon: "airplane_ticket", perm: "ticket_sales.manage" },
      { href: "/admin/services", label: "Services", icon: "room_service" },
      { href: "/admin/airlines", label: "Compagnies", icon: "flight" },
    ],
  },
  {
    label: "Contenu",
    items: [
      { href: "/admin/actualites", label: "Actualités", icon: "newspaper" },
      { href: "/admin/slider", label: "Slider accueil", icon: "view_carousel", perm: "slider.manage" },
      { href: "/admin/messages", label: "Messages", icon: "forum" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { href: "/admin/finances", label: "Finances", icon: "account_balance_wallet", perm: "finances.view" },
      { href: "/admin/paiements-en-ligne", label: "Paiement en ligne", icon: "credit_card", perm: ["paiements.liens", "paiements.passerelles"] },
    ],
  },
  {
    label: "WhatsApp",
    items: [
      { href: "/admin/whatsapp", label: "Tableau de bord WhatsApp", icon: "insights", perm: "whatsapp.dashboard" },
      { href: "/admin/whatsapp/conversations", label: "Conversations", icon: "forum", perm: ["whatsapp.conversations.all", "whatsapp.conversations.own"], badgeKey: "whatsapp" },
      { href: "/admin/whatsapp/contacts", label: "Contacts", icon: "contacts", perm: "whatsapp.contacts" },
      { href: "/admin/whatsapp/taches", label: "Tâches & alertes", icon: "task_alt", perm: ["whatsapp.tasks", "whatsapp.conversations.all", "whatsapp.conversations.own"] },
      { href: "/admin/whatsapp/ia", label: "Agent IA", icon: "smart_toy", perm: "ia.settings" },
      { href: "/admin/whatsapp/connaissances", label: "Base de connaissances", icon: "menu_book", perm: "ia.knowledge" },
      { href: "/admin/whatsapp/bac-a-sable", label: "Bac à sable IA", icon: "science", perm: "ia.sandbox" },
      { href: "/admin/whatsapp/templates", label: "Templates Meta", icon: "description", perm: "whatsapp.templates" },
      { href: "/admin/whatsapp/declencheurs", label: "Déclencheurs", icon: "bolt", perm: "whatsapp.triggers" },
      { href: "/admin/whatsapp/liens", label: "Liens & QR codes", icon: "qr_code_2", perm: "whatsapp.links" },
      { href: "/admin/whatsapp/campagnes", label: "Campagnes", icon: "campaign", perm: ["whatsapp.campaigns", "whatsapp.campaigns.approve"] },
      { href: "/admin/whatsapp/statistiques", label: "Statistiques", icon: "bar_chart", perm: ["whatsapp.costs", "whatsapp.campaigns", "whatsapp.conversations.all"] },
      { href: "/admin/whatsapp/couts", label: "Coûts Meta & Claude", icon: "savings", perm: "whatsapp.costs" },
      { href: "/admin/whatsapp/journal", label: "Journal & audit IA", icon: "fact_check", perm: "audit.view" },
      { href: "/admin/whatsapp/equipe", label: "Équipe & horaires", icon: "support_agent", perm: "whatsapp.team" },
      { href: "/admin/whatsapp/parametres", label: "Paramètres WhatsApp", icon: "chat", perm: "whatsapp.settings" },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { href: "/admin/parametres", label: "Infos agence", icon: "storefront" },
      { href: "/admin/parametres/utilisateurs", label: "Utilisateurs", icon: "manage_accounts", perm: "utilisateurs.manage", badgeKey: "accountRequests" },
      { href: "/admin/parametres/roles", label: "Rôles & permissions", icon: "admin_panel_settings", perm: "roles.manage" },
      { href: "/admin/securite", label: "Sécurité du compte", icon: "shield" },
    ],
  },
];

// Actions rapides de la palette de commandes (Ctrl/Cmd + K).
const QUICK_ACTIONS = [
  { href: "/admin/inscriptions/new", label: "Nouvelle inscription", icon: "person_add", hint: "Inscrits" },
  { href: "/admin/programmes/new", label: "Nouveau programme", icon: "add_circle", hint: "Programmes" },
  { href: "/admin/hotels", label: "Ajouter un hôtel", icon: "domain_add", hint: "Hôtels" },
  { href: "/admin/visa-types/new", label: "Nouveau type de visa", icon: "badge", hint: "Types de visa" },
  { href: "/admin/visa-services/new", label: "Nouvelle demande", icon: "assignment", hint: "Service visa", perm: "visa_services.manage" },
  { href: "/admin/billets/new", label: "Nouvelle vente de billet", icon: "airplane_ticket", hint: "Billets d'avion", perm: "ticket_sales.manage" },
  { href: "/admin/actualites/new", label: "Nouvelle actualité", icon: "newspaper", hint: "Actualités" },
];

// Police d'icônes : sous-ensemble Google Fonts limité aux glyphes utilisés
// (ADMIN_ICON_NAMES, Icon.jsx) — quelques Ko au lieu de ~3 Mo.
const ICON_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..500,0..1,0" +
  `&icon_names=${ADMIN_ICON_NAMES.join(",")}&display=block`;

// Layout racine de l'espace interne — indépendant de app/(site)/layout.js.
// Charte visuelle : designadmin.md (shell AdminShell + app/admin/admin-theme.css).
export default async function AdminLayout({ children }) {
  const session = await getSession();
  const locale = await getAdminLocale();
  // Multi-agences : le nom de l'agence courante (sous-domaine).
  const agency = await getCurrentAgency();

  let groups = [];
  let quickActions = [];
  let settings = null;

  if (session) {
    const perms = [
      ...new Set([...NAV_GROUPS.flatMap((g) => g.items), ...QUICK_ACTIONS].flatMap((i) => [].concat(i.perm || []))),
    ];
    const [granted, registrationsCount, agencySettings, whatsappPending, accountRequests] = await Promise.all([
      Promise.all(perms.map((p) => hasPermission(session, p))),
      countActiveRegistrations().catch(() => 0),
      getAgencySettings().catch(() => null),
      // Conversations WhatsApp transférées sans réponse humaine (son périmètre).
      countPendingForStaff(session).catch(() => 0),
      // Demandes de compte en attente de validation (migration 041).
      countPendingSignupRequests().catch(() => 0),
    ]);
    settings = agencySettings;
    const allowed = new Set(perms.filter((_, i) => granted[i]));
    const badges = {
      registrations: registrationsCount || null,
      whatsapp: whatsappPending || null,
      accountRequests: accountRequests || null,
    };
    const keep = (item) => !item.perm || [].concat(item.perm).some((p) => allowed.has(p));

    groups = NAV_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.filter(keep).map(({ perm, badgeKey, ...item }) => ({
        ...item,
        badge: badgeKey ? badges[badgeKey] : null,
      })),
    })).filter((g) => g.items.length > 0);
    quickActions = QUICK_ACTIONS.filter(keep).map(({ perm, ...a }) => a);
  }

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      // Tant que le traducteur DOM n'a pas tourné (arabe/anglais), la page est
      // masquée pour éviter un flash de texte français — levé par
      // AdminLocaleProvider, ou par le <noscript> ci-dessous sans JavaScript.
      {...(locale !== "fr" ? { "data-i18n-pending": "" } : {})}
      className={`gf-admin ${geistSans.variable} ${geistMono.variable} ${kufi.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={ICON_FONT_URL} />
      </head>
      <body className="min-h-full font-sans">
        <noscript>
          <style>{"html[data-i18n-pending] body { visibility: visible !important; }"}</style>
        </noscript>
        <AdminLocaleProvider locale={locale} brandName={agency.name}>
          {!session ? (
            <div className="gf-login">
              <div className="flex justify-end px-6 pt-4">
                <AdminLanguageSwitcher />
              </div>
              {children}
            </div>
          ) : (
            <AdminShell
              groups={groups}
              quickActions={quickActions}
              agency={{ name: agency.name, city: settings?.city || null }}
              user={{ fullName: session.fullName, role: session.role }}
            >
              {children}
            </AdminShell>
          )}
        </AdminLocaleProvider>
      </body>
    </html>
  );
}
