import { notFound } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getProgramBySlug, getOpenTripsForProgram } from "@/lib/programs";
import { listPublishedFaqsForProgram } from "@/lib/programFaqs";
import ProgramDetail from "@/app/_components/ProgramDetail";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates } from "@/lib/i18n/seo";

export const revalidate = 300;

async function loadProgram(slug, agencyId) {
  const program = await getProgramBySlug(slug, agencyId).catch(() => null);
  if (!program || program.family !== "omra_hajj") return null;
  return program;
}

export async function generateMetadata({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await loadProgram(slug, agencyRow.id);

  if (!program) {
    return { title: makeTranslator(locale, "public", { brandName: agencyRow.name })("Programme introuvable") };
  }

  return {
    title: program.meta_title || program.title,
    description: program.meta_description || program.short_description,
    alternates: pageAlternates(locale, `/omra-hajj/${slug}`),
  };
}

export default async function OmraHajjDetailPage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await loadProgram(slug, agencyRow.id);

  if (!program) {
    notFound();
  }

  const [trips, faqs] = await Promise.all([
    getOpenTripsForProgram(program.id, agencyRow.id, locale).catch(() => []),
    listPublishedFaqsForProgram(program.id, agencyRow.id).catch(() => []),
  ]);

  return (
    <ProgramDetail
      program={program}
      trips={trips}
      family="omra_hajj"
      faqs={faqs}
      locale={locale}
      agency={{ id: agencyRow.id, name: agencyRow.name, subdomain }}
    />
  );
}
