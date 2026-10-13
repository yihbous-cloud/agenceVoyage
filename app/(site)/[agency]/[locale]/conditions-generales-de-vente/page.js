import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getAgencySettings } from "@/lib/agencySettings";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";
import { canonicalLocaleFor } from "@/lib/i18n/contentLocale";
import PageJsonLd from "@/app/_components/PageJsonLd";
import Breadcrumbs from "@/app/_components/Breadcrumbs";
import RichText from "@/app/_components/RichText";

// Conditions générales de vente saisies dans /admin/parametres (référencement,
// vague 1C — CLAUDE.md §3centseizequadragies) : version arabe en arabe,
// version française sinon ; l'autre version sert de repli. Page introuvable
// tant qu'aucun texte n'est saisi (le lien du pied de page reste masqué).
async function loadCgv(subdomain, locale) {
  const agencyRow = await requirePublicAgency(subdomain);
  const s = (await getAgencySettings(agencyRow.id).catch(() => null)) || {};
  const texts = { ar: s.cgv_ar?.trim() || null, fr: s.cgv_fr?.trim() || null };
  const available = ["ar", "fr"].filter((l) => texts[l]);
  if (available.length === 0) return { agencyRow, text: null };
  const wanted = locale === "ar" ? "ar" : "fr";
  const shown = texts[wanted] ? wanted : available[0];
  // Même logique de langue que les contenus traduits (vague 1B) : une page
  // affichée dans une langue sans version renvoie vers la langue disponible.
  const row = { content_locale: available[0], available_locales: available };
  return { agencyRow, text: texts[shown], shownLocale: shown, row };
}

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale } = await params;
  const { agencyRow, text, row } = await loadCgv(subdomain, locale);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  if (!text) return { title: tr("Conditions générales de vente"), robots: { index: false, follow: true } };
  return {
    title: tr("Conditions générales de vente"),
    robots: { index: false, follow: true },
    alternates: pageAlternates(locale, "/conditions-generales-de-vente", { availableLocales: row.available_locales }),
  };
}

export default async function CgvPage({ params }) {
  const { agency: subdomain, locale } = await params;
  const { agencyRow, text, shownLocale, row } = await loadCgv(subdomain, locale);
  if (!text) notFound();
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const title = tr("Conditions générales de vente");

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <PageJsonLd
        agency={agencyRow}
        locale={locale}
        path="/conditions-generales-de-vente"
        canonicalLocale={canonicalLocaleFor(locale, row)}
        name={title}
        breadcrumb={[{ name: tr("Accueil"), href: "/" }, { name: title }]}
      />
      <Breadcrumbs
        className="mb-6"
        locale={locale}
        label={tr("Fil d'Ariane")}
        items={[{ name: tr("Accueil"), href: "/" }, { name: title }]}
      />
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{title}</h1>
      <div
        className="mt-8 text-sm leading-relaxed"
        lang={shownLocale}
        dir={shownLocale === "ar" ? "rtl" : "ltr"}
      >
        <RichText text={text} />
      </div>
    </main>
  );
}
