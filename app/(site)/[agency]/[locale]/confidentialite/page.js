import Link from "@/app/_components/LocalizedLink";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getAgencySettings } from "@/lib/agencySettings";
import { getAccountForAgency } from "@/lib/whatsapp/accounts";
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
    title: tr("Politique de confidentialité"),
    robots: { index: false, follow: true },
    alternates: pageAlternates(locale, "/confidentialite"),
  };
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

// Politique de confidentialité décrivant les traitements réels du site et
// de l'agence (référencement, vague 1C — CLAUDE.md §3centseizequadragies).
// La partie « mesure d'audience » suit l'identifiant GTM saisi dans
// /admin/parametres ; le n° CNDP n'apparaît que s'il est renseigné.
export default async function ConfidentialitePage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const s = (await getAgencySettings(agencyRow.id).catch(() => null)) || {};
  const whatsappAccount = await getAccountForAgency(agencyRow.id).catch(() => null);
  const automatedReplies = whatsappAccount?.status === "actif";
  const address = [s.address, s.city].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path="/confidentialite"
        name={tr("Politique de confidentialité")}
        breadcrumb={[{ name: tr("Accueil"), href: "/" }, { name: tr("Politique de confidentialité") }]}
      />
      <Breadcrumbs
        className="mb-6"
        locale={locale}
        label={tr("Fil d'Ariane")}
        items={[{ name: tr("Accueil"), href: "/" }, { name: tr("Politique de confidentialité") }]}
      />
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{tr("Politique de confidentialité")}</h1>

      <div className="mt-8 space-y-8 text-sm">
        <LegalSection
          title={tr("Responsable du traitement")}
          rows={[
            [tr("Raison sociale"), s.legal_name || agencyRow.name],
            [tr("Adresse"), address],
            [tr("Email"), s.email],
            [tr("Téléphone"), s.phone],
          ]}
        />

        <Section title={tr("Données collectées")}>
          <ul className="list-disc space-y-1 ps-5">
            <li>{tr("Formulaire de contact : nom, email, téléphone (facultatif) et votre message.")}</li>
            <li>{tr("Inscription en ligne : nom, numéro WhatsApp et email (facultatif).")}</li>
            <li>{tr("Dossier de voyage, complété avec notre équipe : identité, passeport, informations de visa, hébergement et paiements.")}</li>
            <li>
              {tr("Échanges WhatsApp : vos messages et les documents que vous nous envoyez.")}
              {automatedReplies && (
                <> {tr("Certaines réponses peuvent être préparées par un assistant automatisé, sous le contrôle de notre équipe.")}</>
              )}
            </li>
          </ul>
        </Section>

        <Section title={tr("Utilisation des données")}>
          <p>
            {tr("Ces données servent uniquement à répondre à vos demandes, organiser votre voyage (réservations d'hôtels et de vols, démarches de visa), suivre vos paiements et respecter nos obligations légales.")}
          </p>
        </Section>

        <Section title={tr("Destinataires")}>
          <p>
            {tr("Elles ne sont partagées qu'avec les organismes nécessaires au voyage (compagnies aériennes, hôtels, autorités consulaires pour les visas) et avec nos prestataires techniques (hébergement du site, messagerie WhatsApp). Elles ne sont jamais vendues.")}
          </p>
        </Section>

        <Section title={tr("Durée de conservation")}>
          <p>
            {tr("Elles sont conservées le temps nécessaire à l'organisation du voyage et au suivi de votre dossier, puis selon les durées imposées par la loi (obligations comptables notamment).")}
          </p>
        </Section>

        <Section title={tr("Origine de votre visite")}>
          <p>
            {tr("Lors de votre première visite, le site enregistre dans votre navigateur (stockage local, pendant 90 jours) le site d'où vous venez, la page d'arrivée et les éventuels paramètres de campagne. Ces informations ne nous sont transmises que si vous remplissez un formulaire, pour savoir comment vous nous avez connus. Vous pouvez les effacer en supprimant les données de navigation de ce site.")}
          </p>
        </Section>

        <Section title={tr("Cookies et mesure d'audience")}>
          {s.gtm_container_id ? (
            <p>
              {tr("Avec votre accord seulement, le site utilise Google Analytics (via Google Tag Manager) pour mesurer son audience. Ces cookies ne sont déposés qu'après avoir cliqué sur « Accepter ». Vous pouvez changer d'avis à tout moment avec le lien « Gérer les cookies » en bas de page. Aucun cookie publicitaire n'est utilisé.")}
            </p>
          ) : (
            <p>{tr("Le site n'utilise aucun cookie de mesure d'audience ni publicitaire.")}</p>
          )}
        </Section>

        <Section title={tr("Vos droits")}>
          <p>
            {tr("Conformément à la loi 09-08, vous disposez d'un droit d'accès, de rectification et d'opposition au traitement de vos données.")}{" "}
            {tr("Pour l'exercer, contactez-nous")}
            {s.email && (
              <>
                {" "}
                (<bdi>{s.email}</bdi>)
              </>
            )}{" "}
            {tr("ou via la page")}{" "}
            <Link href="/contact" className="text-[#A8863C] hover:underline">
              {tr("Contact")}
            </Link>
            .
          </p>
          {s.cndp_number && (
            <p>
              {tr("Ce traitement a fait l'objet d'une déclaration / autorisation auprès de la CNDP sous le n° {numero}.", {
                numero: s.cndp_number,
              })}
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}
