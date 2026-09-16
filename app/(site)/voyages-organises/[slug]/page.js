import { notFound } from "next/navigation";
import { getProgramBySlug, getOpenTripsForProgram } from "@/lib/programs";
import { listPublishedFaqsForProgram } from "@/lib/programFaqs";
import ProgramDetail from "../../_components/ProgramDetail";

export const revalidate = 300;

async function loadProgram(slug) {
  const program = await getProgramBySlug(slug).catch(() => null);
  if (!program || program.family !== "voyage_organise") return null;
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

export default async function VoyageOrganiseDetailPage({ params }) {
  const { slug } = await params;
  const program = await loadProgram(slug);

  if (!program) {
    notFound();
  }

  const [trips, faqs] = await Promise.all([
    getOpenTripsForProgram(program.id).catch(() => []),
    listPublishedFaqsForProgram(program.id).catch(() => []),
  ]);

  return (
    <ProgramDetail
      program={program}
      trips={trips}
      family="voyage_organise"
      faqs={faqs}
    />
  );
}
