import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { listPublishedTerms, glossaryLocales } from "@/lib/glossary";
import { GUIDE_HUB_PATH, GLOSSARY_PATH } from "@/lib/editorial";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { definedTermSetNode } from "@/lib/seo/jsonLd";
import PageJsonLd from "@/app/_components/PageJsonLd";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import RichText from "@/app/_components/RichText";

// Lexique bilingue (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies) : tous les termes publiés dans la langue de la
// page, de A à Z, balisés DefinedTermSet. 404 tant qu'aucun terme n'existe
// dans cette langue. Les pages par terme viendront en phase 3 (PSEO).
export const revalidate = 300;

const TITLE = "Lexique : les mots de la Omra, du Hajj et du voyage";
// Titre de l'onglet et de Google : court (suivi du nom de l'agence, 60 caractères en tout).
const META_TITLE = "Lexique Omra et Hajj";
const DESCRIPTION =
  "Définitions simples des mots de la Omra, du Hajj et du voyage organisé : ihram, tawaf, sa'i, miqat et bien d'autres.";

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const locales = await glossaryLocales(agencyRow.id).catch(() => []);
  const alternates = pageAlternates(locale, GLOSSARY_PATH, { availableLocales: locales.length > 0 ? locales : undefined });
  return {
    title: tr(META_TITLE),
    description: tr(DESCRIPTION),
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: tr(META_TITLE),
      description: tr(DESCRIPTION),
      url: alternates.canonical,
      logoUrl: agencyRow.logo_url,
    }),
  };
}

// Première lettre (regroupement visuel), insensible aux accents.
const initialOf = (name) =>
  String(name || "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .charAt(0)
    .toUpperCase();

export default async function GlossaryPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const terms = await listPublishedTerms(agencyRow.id, locale).catch(() => []);
  if (terms.length === 0) notFound();

  const groups = [];
  for (const term of terms) {
    const letter = initialOf(term.name);
    if (groups.length === 0 || groups[groups.length - 1].letter !== letter) groups.push({ letter, terms: [] });
    groups[groups.length - 1].terms.push(term);
  }
  const breadcrumb = [
    { name: tr("Accueil"), href: "/" },
    { name: tr("Guides pratiques"), href: GUIDE_HUB_PATH },
    { name: tr("Lexique") },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path={GLOSSARY_PATH}
        name={tr(TITLE)}
        description={tr(DESCRIPTION)}
        pageType="CollectionPage"
        breadcrumb={breadcrumb}
        mainEntity="lexique"
        nodes={(url) => [definedTermSetNode({ url, name: tr(TITLE), terms })]}
      />
      <Breadcrumbs className="mb-6" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />
      <h1 className="font-display text-3xl text-ink">{tr(TITLE)}</h1>
      <p className="mt-3 text-muted">{tr(DESCRIPTION)}</p>

      <nav aria-label={tr("Lettres")} className="mt-6 flex flex-wrap gap-2 text-sm">
        {groups.map((group) => (
          <a key={group.letter} href={`#lettre-${group.letter}`} className="border border-gold-pale px-2 py-0.5 text-[#A8863C] hover:bg-white">
            {group.letter}
          </a>
        ))}
      </nav>

      {groups.map((group) => (
        <section key={group.letter} id={`lettre-${group.letter}`} className="mt-10">
          <h2 className="border-b border-gold-pale pb-1 font-display text-2xl text-[#A8863C]">{group.letter}</h2>
          <dl className="mt-4 space-y-5">
            {group.terms.map((term) => (
              <div key={term.slug} id={term.slug}>
                <dt className="font-medium text-ink">{term.name}</dt>
                <dd className="mt-1 text-sm text-muted">
                  <RichText text={term.definition} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </main>
  );
}
