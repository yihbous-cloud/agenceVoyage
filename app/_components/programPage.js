import { notFound, permanentRedirect } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getProgramBySlug, getOpenTripsForProgram } from "@/lib/programs";
import { listPublishedFaqsForProgram } from "@/lib/programFaqs";
import { programPath, programPillar } from "@/lib/programUrls";
import { programContentLocale } from "@/lib/i18n/contentLocale";
import { localizePath } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { plainSummary } from "@/lib/markdown";
import ProgramDetail from "./ProgramDetail";

// Fiche programme publique, partagée par les trois piliers (/omra/[slug],
// /hajj/[slug], /voyages-organises/[slug] — CLAUDE.md §3centtreizequadragies).
// `pillar` : "omra" | "hajj" | "voyage" (lib/programUrls.js). Un programme
// ouvert sous le mauvais pilier (type changé dans l'admin, ancien lien) est
// redirigé de façon permanente vers le bon, jamais affiché en double.

async function loadProgram(subdomain, slug) {
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await getProgramBySlug(slug, agencyRow.id).catch(() => null);
  return { agencyRow, program };
}

export async function programMetadata(params) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, program } = await loadProgram(subdomain, slug);

  if (!program) {
    return { title: makeTranslator(locale, "public", { brandName: agencyRow.name })("Programme introuvable") };
  }

  const alternates = pageAlternates(locale, programPath(program), {
    contentLocale: programContentLocale(program),
  });
  const description =
    program.meta_description || plainSummary(program.short_description || program.full_description);

  return {
    // Un titre SEO saisi dans l'admin est utilisé tel quel (il contient déjà
    // la marque) : le gabarit « … | marque » du layout l'aurait doublée.
    title: program.meta_title ? { absolute: program.meta_title } : program.title,
    description,
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: program.meta_title || program.title,
      description,
      url: alternates.canonical,
      image: program.cover_image_url,
      logoUrl: agencyRow.logo_url,
    }),
  };
}

export async function renderProgramPage(params, pillar) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, program } = await loadProgram(subdomain, slug);

  if (!program) {
    notFound();
  }
  if (programPillar(program) !== pillar) {
    permanentRedirect(localizePath(programPath(program), locale));
  }

  const [trips, faqs] = await Promise.all([
    getOpenTripsForProgram(program.id, agencyRow.id, locale).catch(() => []),
    listPublishedFaqsForProgram(program.id, agencyRow.id).catch(() => []),
  ]);

  return (
    <ProgramDetail
      program={program}
      trips={trips}
      family={program.family}
      faqs={faqs}
      locale={locale}
      agency={{ id: agencyRow.id, name: agencyRow.name, subdomain }}
    />
  );
}
