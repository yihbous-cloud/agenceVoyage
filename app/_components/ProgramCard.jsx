import Link from "next/link";
import { SEASON_LABELS, formatDate, computeDuration } from "./formatTrip";

// Carte de programme unique, habillage conditionné par `program.family` —
// pas de composant dupliqué par famille (voir prompt de séparation du
// catalogue). L'ordre des informations affichées diffère volontairement
// entre les deux familles (achat engagé vs achat inspirationnel).
export default function ProgramCard({ program }) {
  const href =
    program.family === "omra_hajj"
      ? `/omra-hajj/${program.slug}`
      : `/voyages-organises/${program.slug}`;
  const duration = computeDuration(program.next_departure_date, program.next_return_date);
  const isOmraHajj = program.family === "omra_hajj";

  return (
    <Link
      href={href}
      className={`block overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isOmraHajj ? "border-emerald-100" : "border-amber-100"
      }`}
    >
      {!isOmraHajj && program.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={program.cover_image_url}
          alt=""
          className="h-40 w-full object-cover"
        />
      )}

      <div className="p-6">
        {isOmraHajj && program.season && (
          <span className="mb-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {SEASON_LABELS[program.season] || program.season}
          </span>
        )}
        {!isOmraHajj && program.theme && (
          <span className="mb-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            {program.theme}
          </span>
        )}

        <h3 className="text-lg font-semibold text-zinc-900">{program.title}</h3>

        {isOmraHajj ? (
          <div className="mt-2 space-y-1 text-sm text-zinc-600">
            {program.next_departure_date && (
              <p>
                Départ le {formatDate(program.next_departure_date)}
                {duration && ` · ${duration.days}j / ${duration.nights}n`}
              </p>
            )}
            {program.origin_iata && <p>Au départ de {program.origin_iata}</p>}
            {program.distance_haram_m != null && (
              <p>À {program.distance_haram_m} m de la Haram</p>
            )}
            {program.seats_remaining != null && (
              <p>{program.seats_remaining} places restantes</p>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-zinc-600">
            {program.destination_country && <p>{program.destination_country}</p>}
            {duration && (
              <p>
                {duration.days} jours / {duration.nights} nuits
              </p>
            )}
          </div>
        )}

        {program.starting_price && (
          <p className="mt-3 text-lg font-bold text-emerald-700">
            à partir de {program.starting_price} {program.currency}
          </p>
        )}
      </div>
    </Link>
  );
}
