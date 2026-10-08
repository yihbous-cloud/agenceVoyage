import { getAgencySettings } from "@/lib/agencySettings";
import { requirePublicAgency } from "@/lib/publicAgency";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("À propos"),
    description: tr(
      "Golden Fantastic, agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques."
    ),
    alternates: pageAlternates(locale, "/a-propos"),
  };
}

export default async function AProposPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const agency = await getAgencySettings(agencyRow.id).catch(() => null);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("À propos de Golden Fantastic")}</h1>

      <div className="mt-6 space-y-4 text-zinc-700">
        <p>
          {tr("Golden Fantastic est une agence de voyages spécialisée dans l'organisation de programmes d'Omra, de Hajj et de séjours touristiques. Nous accompagnons nos voyageurs à chaque étape : choix du programme, formalités de visa, hébergement, transport et suivi pendant tout le séjour.")}
        </p>
        <p>
          {tr("Notre équipe travaille avec des hôtels partenaires proches des lieux saints et avec des compagnies aériennes reconnues (Royal Air Maroc, Saudia, Turkish Airlines) pour vous garantir un voyage serein, du départ jusqu'au retour.")}
        </p>
        <p>
          {tr("Chaque programme est organisé avec attention : répartition des chambres, suivi des documents de visa, rappels par WhatsApp pour ne rien oublier avant le départ.")}
        </p>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900">{tr("Nos valeurs")}</h2>
      <ul className="mt-4 space-y-2 text-zinc-700">
        <li>— {tr("Transparence sur les prix et les prestations incluses")}</li>
        <li>— {tr("Accompagnement humain, joignable par WhatsApp")}</li>
        <li>— {tr("Sélection rigoureuse des hôtels et compagnies partenaires")}</li>
      </ul>

      {agency && (agency.address || agency.phone || agency.email) && (
        <>
          <h2 className="mt-10 text-xl font-semibold text-zinc-900">{tr("Coordonnées")}</h2>
          <ul className="mt-4 space-y-2 text-zinc-700">
            {agency.address && (
              <li>
                <strong>{tr("Adresse")} :</strong> {agency.address}
                {agency.city ? `, ${agency.city}` : ""}
              </li>
            )}
            {agency.phone && (
              <li>
                <strong>{tr("Téléphone")} :</strong> <bdi>{agency.phone}</bdi>
              </li>
            )}
            {agency.whatsapp && (
              <li>
                <strong>{tr("WhatsApp")} :</strong> <bdi>{agency.whatsapp}</bdi>
              </li>
            )}
            {agency.email && (
              <li>
                <strong>{tr("Email")} :</strong> <bdi>{agency.email}</bdi>
              </li>
            )}
          </ul>
        </>
      )}
    </main>
  );
}
