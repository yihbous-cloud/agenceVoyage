import ContactForm from "./ContactForm";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getAgencySettings } from "@/lib/agencySettings";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";
import PageJsonLd from "@/app/_components/PageJsonLd";
import Breadcrumbs from "@/app/_components/Breadcrumbs";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  return {
    title: tr("Contact"),
    description: tr(
      "Contactez Golden Fantastic pour toute question sur nos programmes Omra, Hajj et séjours touristiques."
    ),
    alternates: pageAlternates(locale, "/contact"),
  };
}

export default async function ContactPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const agency = await getAgencySettings(agencyRow.id).catch(() => null);
  const toComplete = `[${tr("à compléter dans /admin/parametres")}]`;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path="/contact"
        name={tr("Contact")}
        pageType="ContactPage"
        breadcrumb={[{ name: tr("Accueil"), href: "/" }, { name: tr("Contact") }]}
      />
      <Breadcrumbs
        className="mb-6"
        locale={locale}
        label={tr("Fil d'Ariane")}
        items={[{ name: tr("Accueil"), href: "/" }, { name: tr("Contact") }]}
      />
      <h1 className="text-3xl font-bold text-zinc-900">{tr("Contact")}</h1>
      <p className="mt-3 text-zinc-600">
        {tr("Une question sur un programme ou votre inscription ? Écrivez-nous, ou contactez-nous directement sur WhatsApp.")}
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-3 text-sm text-zinc-700">
          <p>
            <strong>{tr("WhatsApp")} :</strong>{" "}
            {agency?.whatsapp ? <bdi>{agency.whatsapp}</bdi> : toComplete}
          </p>
          <p>
            <strong>{tr("Email")} :</strong>{" "}
            {agency?.email ? <bdi>{agency.email}</bdi> : toComplete}
          </p>
          <p>
            <strong>{tr("Adresse")} :</strong>{" "}
            {agency?.address
              ? `${agency.address}${agency.city ? `, ${agency.city}` : ""}`
              : toComplete}
          </p>
        </div>

        <ContactForm />
      </div>
    </main>
  );
}
