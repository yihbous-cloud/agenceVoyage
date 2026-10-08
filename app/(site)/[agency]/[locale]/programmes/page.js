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
  };
}

// Le catalogue a été séparé en deux hubs dédiés (/omra-hajj et
// /voyages-organises, voir prompt de séparation du catalogue). Cette page
// n'est plus le hub principal mais reste en place (au lieu d'un simple 404)
// pour ne pas casser un lien existant vers /programmes.
export default async function ProgrammesRedirectPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("Nos programmes")}</h1>
      <p className="max-w-xl text-zinc-600">
        {tr("Nos programmes sont désormais répartis en deux catalogues dédiés :")}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/omra-hajj"
          className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
        >
          {tr("Omra & Hajj")}
        </Link>
        <Link
          href="/voyages-organises"
          className="rounded-full bg-amber-600 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-700"
        >
          {tr("Voyages organisés")}
        </Link>
      </div>
    </main>
  );
}
