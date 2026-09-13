import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export const metadata = {
  title: "Espace interne",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const session = await getSession();

  if (!session) {
    return <div className="flex flex-1 flex-col bg-zinc-50">{children}</div>;
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600">
            <Link href="/admin" className="text-zinc-900">
              Tableau de bord
            </Link>
            <Link href="/admin/inscriptions" className="hover:text-emerald-700">
              Inscrits
            </Link>
            <Link href="/admin/programmes" className="hover:text-emerald-700">
              Programmes
            </Link>
            <Link href="/admin/hotels" className="hover:text-emerald-700">
              Hôtels
            </Link>
            <Link href="/admin/visa-types" className="hover:text-emerald-700">
              Types de visa
            </Link>
            <Link href="/admin/services" className="hover:text-emerald-700">
              Services
            </Link>
            <Link href="/admin/airlines" className="hover:text-emerald-700">
              Compagnies
            </Link>
            {["direction", "comptabilite"].includes(session.role) && (
              <Link href="/admin/finances" className="hover:text-emerald-700">
                Finances
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>
              {session.fullName} · <span className="capitalize">{session.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
