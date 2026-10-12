import { notFound, permanentRedirect } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getProgramBySlug } from "@/lib/programs";
import { programPath } from "@/lib/programUrls";
import { localizePath } from "@/lib/i18n/locales";

// Ancienne URL (avant la séparation Omra / Hajj en deux piliers, CLAUDE.md
// §3centtreizequadragies) : redirection permanente vers /omra/[slug] ou
// /hajj/[slug] (ou /voyages-organises/[slug]) selon le programme.
export default async function LegacyOmraHajjProgramPage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await getProgramBySlug(slug, agencyRow.id).catch(() => null);

  if (!program) {
    notFound();
  }

  permanentRedirect(localizePath(programPath(program), locale));
}
