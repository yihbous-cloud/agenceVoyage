import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Nos programmes"),
    description: tr("Découvrez nos programmes Omra & Hajj ainsi que nos voyages organisés."),
    alternates: pageAlternates(locale, "/programmes"),
    // Simple page d'aiguillage vers les piliers : utile aux anciens liens,
    // sans contenu propre à indexer.
    robots: { index: false, follow: true },
  };
}

// Ancienne URL du catalogue unique. Le catalogue est désormais réparti en
// trois piliers (/omra, /hajj, /voyages-organises — CLAUDE.md
// §3centtreizequadragies) ; cette page reste en place (au lieu d'un 404) pour
// ne pas casser un lien existant vers /programmes.
export default async function ProgrammesRedirectPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("Nos programmes")}</h1>
      <p className="max-w-xl text-zinc-600">
        {tr("Nos programmes sont répartis en trois catalogues :")}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {[
          { href: "/omra", label: "Omra" },
          { href: "/hajj", label: "Hajj" },
          { href: "/voyages-organises", label: "Voyages organisés" },
        ].map((pillar) => (
          <Link
            key={pillar.href}
            href={pillar.href}
            className="bg-gold px-6 py-3 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            {tr(pillar.label)}
          </Link>
        ))}
      </div>
    </main>
  );
}
