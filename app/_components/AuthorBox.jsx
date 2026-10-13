import Image from "next/image";
import { authorDisplay } from "@/lib/editorial";
import { INTL_TAGS } from "@/lib/i18n/locales";
import { formatDate } from "./formatTrip";

// Encadré auteur d'un guide (vague 2B du référencement, cahier §13 —
// E-E-A-T) : qui a rédigé, son rôle, son expérience, et qui a relu (référent
// religieux pour un contenu religieux). Composant serveur.
export default function AuthorBox({ author, reviewer, reviewedAt, locale, tr }) {
  const a = authorDisplay(author, locale);
  const r = authorDisplay(reviewer, locale);
  if (!a && !r) return null;
  return (
    <aside className="mt-10 border border-gold-pale bg-white p-5">
      {a && (
        <div className="flex gap-4">
          {author.photo_url && (
            <Image
              src={author.photo_url}
              alt={a.name}
              width={72}
              height={72}
              className="h-18 w-18 shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted uppercase">{tr("Rédigé par")}</p>
            <p className="font-medium text-ink">{a.name}</p>
            {a.jobTitle && <p className="text-sm text-muted">{a.jobTitle}</p>}
            {Number(author.trips_supervised) > 0 && (
              <p className="text-sm text-muted">
                {tr.plural("{count} voyage encadré", "{count} voyages encadrés", Number(author.trips_supervised))}
              </p>
            )}
            {a.bio && <p className="mt-2 text-sm text-muted">{a.bio}</p>}
          </div>
        </div>
      )}
      {r && (
        <p className={`text-sm text-muted ${a ? "mt-4 border-t border-gold-pale pt-4" : ""}`}>
          {tr("Relu par {name}", { name: r.name })}
          {r.jobTitle ? ` (${r.jobTitle})` : ""}
          {reviewedAt ? ` · ${tr("le {date}", { date: formatDate(reviewedAt, INTL_TAGS[locale]) })}` : ""}
          {Boolean(reviewer.is_religious_referent) && (
            <span className="ms-2 inline-block bg-[#F7F3E8] px-2 py-0.5 text-xs text-[#A8863C]">{tr("Référent religieux")}</span>
          )}
        </p>
      )}
    </aside>
  );
}
