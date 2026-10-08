import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Politique de confidentialité"),
    robots: { index: false, follow: true },
    alternates: pageAlternates(locale, "/confidentialite"),
  };
}

export default async function ConfidentialitePage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
        {tr("Politique de confidentialité")}
      </h1>

      <div className="mt-6 space-y-4 text-sm">
        <p>
          {tr("Golden Fantastic collecte les informations personnelles nécessaires au traitement de votre inscription (nom, coordonnées, passeport, informations de visa) uniquement dans le cadre de l'organisation de votre voyage.")}
        </p>
        <p>
          {tr("Ces informations sont conservées de manière sécurisée et ne sont partagées qu'avec les organismes nécessaires au voyage (compagnies aériennes, hôtels, autorités consulaires pour les demandes de visa).")}
        </p>
        <p>
          {tr("Vous pouvez demander l'accès, la rectification ou la suppression de vos données personnelles en nous contactant via la page")}{" "}
          <Link href="/contact" className="text-emerald-700 hover:underline">
            {tr("Contact")}
          </Link>
          .
        </p>
        <p className="text-xs text-zinc-400">
          {tr("Ce contenu est un modèle à compléter et à faire valider juridiquement avant mise en production.")}
        </p>
      </div>
    </main>
  );
}
