import { permanentRedirect } from "next/navigation";
import { localizePath } from "@/lib/i18n/locales";

// Ancien hub commun Omra & Hajj : remplacé par les deux piliers /omra et
// /hajj (CLAUDE.md §3centtreizequadragies). Redirection permanente vers
// /omra, en conservant le filtre de saison éventuel.
export default async function LegacyOmraHajjHubPage({ params, searchParams }) {
  const { locale } = await params;
  const { saison } = await searchParams;
  const target = localizePath("/omra", locale);
  permanentRedirect(saison ? `${target}?saison=${encodeURIComponent(saison)}` : target);
}
