import { notFound, permanentRedirect } from "next/navigation";
import { getProgramBySlug } from "@/lib/programs";

// Ancienne URL (avant la séparation du catalogue en deux familles).
// Redirection permanente vers la nouvelle URL préfixée par famille — le
// projet n'ayant jamais été déployé publiquement (tests locaux uniquement,
// voir ETAT_DES_LIEUX.md), aucune URL /programmes/[slug] n'est réellement
// indexée à ce jour, mais la redirection reste en place par précaution.
export default async function LegacyProgramPage({ params }) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug).catch(() => null);

  if (!program) {
    notFound();
  }

  const target =
    program.family === "omra_hajj"
      ? `/omra-hajj/${slug}`
      : `/voyages-organises/${slug}`;

  permanentRedirect(target);
}
