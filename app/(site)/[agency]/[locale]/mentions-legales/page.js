import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Mentions légales"),
    robots: { index: false, follow: true },
    alternates: pageAlternates(locale, "/mentions-legales"),
  };
}

export default async function MentionsLegalesPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("Mentions légales")}</h1>

      <div className="mt-6 space-y-4 text-sm">
        <p>
          <strong>{tr("Éditeur du site")} :</strong>{" "}
          {tr("Golden Fantastic — agence de voyages. [Raison sociale, forme juridique, adresse du siège social, numéro RC/ICE à compléter].")}
        </p>
        <p>
          <strong>{tr("Directeur de la publication")} :</strong> {tr("[Nom à compléter]")}
        </p>
        <p>
          <strong>{tr("Hébergement")} :</strong>{" "}
          {tr("[Nom et adresse de l'hébergeur à compléter — ex. Hostinger].")}
        </p>
        <p>
          <strong>{tr("Contact")} :</strong> {tr("voir la page")}{" "}
          <Link href="/contact" className="text-emerald-700 hover:underline">
            {tr("Contact")}
          </Link>
          .
        </p>
        <p className="text-xs text-zinc-400">
          {tr("Ce contenu est un modèle à compléter avec les informations légales exactes de l'agence avant mise en production.")}
        </p>
      </div>
    </main>
  );
}
