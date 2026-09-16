import { notFound } from "next/navigation";
import { getProgramBySlug, getOpenTripsForProgram } from "@/lib/programs";
import { listVisaTypesForProgram, getVisaTypeWithDocuments } from "@/lib/visaTypes";
import { listPublishedFaqsForProgram } from "@/lib/programFaqs";
import ProgramDetail from "@/app/_components/ProgramDetail";

export const revalidate = 300;

async function loadProgram(slug) {
  const program = await getProgramBySlug(slug).catch(() => null);
  if (!program || program.family !== "omra_hajj") return null;
  return program;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const program = await loadProgram(slug);

  if (!program) {
    return { title: "Programme introuvable" };
  }

  return {
    title: program.meta_title || program.title,
    description: program.meta_description || program.short_description,
  };
}

export default async function OmraHajjDetailPage({ params }) {
  const { slug } = await params;
  const program = await loadProgram(slug);

  if (!program) {
    notFound();
  }

  const [trips, visaTypesBase, faqs] = await Promise.all([
    getOpenTripsForProgram(program.id).catch(() => []),
    listVisaTypesForProgram(program.id).catch(() => []),
    listPublishedFaqsForProgram(program.id).catch(() => []),
  ]);

  const visaTypes = await Promise.all(
    visaTypesBase.map((vt) => getVisaTypeWithDocuments(vt.id))
  );

  return (
    <ProgramDetail
      program={program}
      trips={trips}
      family="omra_hajj"
      visaTypes={visaTypes.filter(Boolean)}
      faqs={faqs}
    />
  );
}
