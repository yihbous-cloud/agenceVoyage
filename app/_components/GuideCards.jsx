import Link from "./LocalizedLink";
import { guidePath, GUIDE_PILLAR_LABELS } from "@/lib/editorial";
import { plainSummary } from "@/lib/markdown";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { formatDate } from "./formatTrip";

// Cartes de guides (vague 2B du référencement) : hub /guide, piliers et
// bloc « Guides utiles » des fiches programme. Composant serveur.
export default function GuideCards({ guides, locale, tr, showPillar = true, columns = 3 }) {
  if (!guides || guides.length === 0) return null;
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
      {guides.map((guide) => {
        const summary = plainSummary(guide.excerpt || guide.content, 180);
        const date = guide.updated_at || guide.published_at;
        return (
          <Link
            key={guide.id}
            href={guidePath(guide.slug)}
            className="group flex flex-col border border-gold-pale bg-white p-5 transition-shadow hover:shadow-md"
          >
            {showPillar && (
              <span className="text-xs font-semibold tracking-wide text-[#A8863C] uppercase">
                {tr(GUIDE_PILLAR_LABELS[guide.pillar] || GUIDE_PILLAR_LABELS.general)}
              </span>
            )}
            <h3 className="mt-1 font-display text-lg text-ink group-hover:text-[#A8863C]">{guide.title}</h3>
            {summary && <p className="mt-2 text-sm text-muted">{summary}</p>}
            {date && (
              <span className="mt-auto pt-3 text-xs text-muted">
                {tr("Mis à jour le {date}", { date: formatDate(date, INTL_TAGS[locale]) })}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
