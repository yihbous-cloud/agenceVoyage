import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getAgencySettings } from "@/lib/agencySettings";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";
import PageJsonLd from "@/app/_components/PageJsonLd";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import { LegalSection } from "@/app/_components/LegalSection";

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

// Mentions légales générées depuis /admin/parametres (référencement, vague
// 1C — CLAUDE.md §3centseizequadragies) : un bloc dont aucune information
// n'est renseignée n'est pas affiché, aucune valeur n'est inventée.
export default async function MentionsLegalesPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const s = (await getAgencySettings(agencyRow.id).catch(() => null)) || {};
  const address = [s.address, s.city].filter(Boolean).join(", ");

  const editor = [
    [tr("Raison sociale"), s.legal_name || agencyRow.name],
    s.legal_name && s.legal_name !== agencyRow.name ? [tr("Nom commercial"), agencyRow.name] : null,
    [tr("Forme juridique"), s.legal_form],
    [tr("Capital social"), s.share_capital],
    [tr("Siège social"), address],
    [tr("Téléphone"), s.phone],
    [tr("Email"), s.email],
    [tr("Registre de commerce (RC)"), s.rc],
    [tr("Identifiant fiscal (IF)"), s.tax_id],
    [tr("ICE"), s.ice],
    [tr("Licence d'agence de voyages (loi 31-96)"), s.license_number],
  ];

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path="/mentions-legales"
        name={tr("Mentions légales")}
        breadcrumb={[{ name: tr("Accueil"), href: "/" }, { name: tr("Mentions légales") }]}
      />
      <Breadcrumbs
        className="mb-6"
        locale={locale}
        label={tr("Fil d'Ariane")}
        items={[{ name: tr("Accueil"), href: "/" }, { name: tr("Mentions légales") }]}
      />
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("Mentions légales")}</h1>

      <div className="mt-8 space-y-8 text-sm">
        <LegalSection title={tr("Éditeur du site")} rows={editor} />
        <LegalSection title={tr("Directeur de la publication")} rows={[[null, s.publication_director]]} />
        <LegalSection title={tr("Assurance responsabilité civile professionnelle")} rows={[[null, s.insurance_info]]} />
        <LegalSection title={tr("Hébergement")} rows={[[null, s.hosting_provider]]} />

        <section>
          <h2 className="text-base font-semibold text-zinc-900">{tr("Données personnelles")}</h2>
          <p className="mt-2 leading-relaxed">
            {tr("Les données personnelles collectées sur ce site sont traitées conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.")}{" "}
            {s.cndp_number && (
              <>
                {tr("Déclaration / autorisation CNDP")} : <bdi>{s.cndp_number}</bdi>.{" "}
              </>
            )}
            {tr("Pour en savoir plus, consultez la")}{" "}
            <Link href="/confidentialite" className="text-[#A8863C] hover:underline">
              {tr("Politique de confidentialité")}
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-zinc-900">{tr("Contact")}</h2>
          <p className="mt-2">
            {tr("voir la page")}{" "}
            <Link href="/contact" className="text-[#A8863C] hover:underline">
              {tr("Contact")}
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
