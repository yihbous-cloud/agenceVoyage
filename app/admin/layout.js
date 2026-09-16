import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import LogoutButton from "./LogoutButton";
import AdminSidebarNav from "./AdminSidebarNav";
import "../globals.css";

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
    default: "Espace interne | Golden Fantastic",
    template: "%s | Espace interne",
  },
  robots: { index: false, follow: false },
};

const NAV_LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/inscriptions", label: "Inscrits" },
  { href: "/admin/programmes", label: "Programmes" },
  { href: "/admin/hotels", label: "Hôtels" },
  { href: "/admin/visa-types", label: "Types de visa" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/airlines", label: "Compagnies" },
  { href: "/admin/actualites", label: "Actualités" },
  { href: "/admin/messages", label: "Messages" },
];

// Section réservée, séparée de la navigation principale : configuration
// utilisée en en-tête des documents générés (reçus de paiement...) et
// administration du personnel/des permissions.
const BASE_SETTINGS_LINKS = [{ href: "/admin/parametres", label: "Infos agence" }];

// Layout racine de l'espace interne — indépendant de app/(site)/layout.js.
// Volontairement séparé du header/footer marketing du site public.
// Navigation en barre latérale gauche (plutôt qu'une barre horizontale en
// haut), avec état actif basé sur le chemin courant (AdminSidebarNav).
export default async function AdminLayout({ children }) {
  const session = await getSession();

  let settingsLinks = BASE_SETTINGS_LINKS;
  let navLinks = NAV_LINKS;

  if (session) {
    const [canViewFinances, canManageUsers, canManageRoles] = await Promise.all([
      hasPermission(session, "finances.view"),
      hasPermission(session, "utilisateurs.manage"),
      hasPermission(session, "roles.manage"),
    ]);

    navLinks = canViewFinances
      ? [...NAV_LINKS, { href: "/admin/finances", label: "Finances" }]
      : NAV_LINKS;

    settingsLinks = [
      ...BASE_SETTINGS_LINKS,
      ...(canManageUsers ? [{ href: "/admin/parametres/utilisateurs", label: "Utilisateurs" }] : []),
      ...(canManageRoles ? [{ href: "/admin/parametres/roles", label: "Rôles & permissions" }] : []),
    ];
  }

  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-zinc-900">
        {!session ? (
          <div className="flex min-h-screen flex-col bg-zinc-50">{children}</div>
        ) : (
          <div className="flex min-h-screen bg-zinc-50">
            <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-5 py-4">
                <Link href="/admin" className="text-lg font-semibold text-zinc-900">
                  Golden Fantastic
                </Link>
                <p className="text-xs text-zinc-500">Espace interne</p>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <AdminSidebarNav links={navLinks} />

                <p className="mt-6 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Paramètres
                </p>
                <AdminSidebarNav links={settingsLinks} />
              </div>

              <div className="border-t border-zinc-200 px-5 py-4">
                <p className="text-sm font-medium text-zinc-900">{session.fullName}</p>
                <p className="text-xs capitalize text-zinc-500">{session.role}</p>
                <div className="mt-3">
                  <LogoutButton />
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8">{children}</div>
          </div>
        )}
      </body>
    </html>
  );
}
