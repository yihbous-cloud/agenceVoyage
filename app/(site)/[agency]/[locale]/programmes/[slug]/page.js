import { notFound, permanentRedirect } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import { getProgramBySlug } from "@/lib/programs";
import { programPath } from "@/lib/programUrls";
import { localizePath } from "@/lib/i18n/locales";

// Ancienne URL (avant la séparation du catalogue en familles, puis en piliers
// Omra / Hajj / voyages organisés) : redirection permanente vers l'URL
// actuelle du programme (lib/programUrls.js).
export default async function LegacyProgramPage({ params }) {
  const { agency: subdomain, locale, slug } = await params;
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await getProgramBySlug(slug, agencyRow.id).catch(() => null);

  if (!program) {
    notFound();
  }

  permanentRedirect(localizePath(programPath(program), locale));
}
