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

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold text-emerald-700">
              Golden Fantastic
            </Link>
            <nav className="text-sm font-medium text-zinc-600">
              <Link href="/programmes" className="hover:text-emerald-700">
                Nos programmes
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} Golden Fantastic
        </footer>
      </body>
    </html>
  );
}
