import Link from "next/link";
import Image from "next/image";
import { SEASON_LABELS, formatDate, computeDuration } from "./formatTrip";

// Carte "vitrine" utilisée uniquement sur l'accueil (habillage doré/sombre du
// style de référence) — distincte de ProgramCard (utilisée sur les hubs
// /omra-hajj et /voyages-organises), dont l'habillage reste inchangé.
// Un seul composant, `program.family` pilote l'habillage, comme pour
// ProgramCard/ProgramDetail.
export default function HomeShowcaseCard({ program }) {
  const href =
    program.family === "omra_hajj"
      ? `/omra-hajj/${program.slug}`
      : `/voyages-organises/${program.slug}`;
  const duration = computeDuration(program.next_departure_date, program.next_return_date);
  const isOmraHajj = program.family === "omra_hajj";

  const imagePlaceholder = (
    <div
      className={`h-full w-full ${
        isOmraHajj
          ? "bg-gradient-to-br from-gold-pale via-cream-card to-gold/30"
          : "bg-gradient-to-br from-ink via-ink-soft to-gold/20"
      }`}
    />
  );

  if (isOmraHajj) {
    return (
      <Link
        href={href}
        className="group flex flex-col border border-gold-pale/60 bg-white transition-shadow hover:shadow-lg"
      >
        <div className="relative h-56 overflow-hidden">
          {program.cover_image_url ? (
            <Image
              src={program.cover_image_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            imagePlaceholder
          )}
          {program.season && (
            <div className="absolute top-5 -left-11 w-40 -rotate-45 bg-ink py-1.5 text-center text-[11px] font-semibold tracking-widest text-gold-pale uppercase">
              {SEASON_LABELS[program.season] || program.season}
            </div>
          )}
          {program.starting_price && (
            <div className="absolute right-0 bottom-0 bg-gold px-4 py-2 font-display text-lg text-ink">
              {program.starting_price} {program.currency}
            </div>
          )}
        </div>
        <div className="flex-1 p-6">
          <h3 className="font-display text-xl font-normal text-ink">{program.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-muted">
            {program.next_departure_date && (
              <p>
                Départ le {formatDate(program.next_departure_date)}
                {duration && ` · ${duration.days}j / ${duration.nights}n`}
              </p>
            )}
            {program.distance_haram_m != null && (
              <p>À {program.distance_haram_m} m de la Haram</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gold-pale/50 px-6 py-4 text-sm text-muted">
          <span>{program.origin_iata ? `Départ ${program.origin_iata}` : " "}</span>
          {program.seats_remaining != null && (
            <span className="tracking-wide text-[#A8863C]">
              {program.seats_remaining} places restantes
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex flex-col border border-gold/25 bg-ink-soft transition-shadow hover:shadow-lg"
    >
      <div className="relative h-56 overflow-hidden">
        {program.cover_image_url ? (
          <Image
            src={program.cover_image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          imagePlaceholder
        )}
        {program.theme && (
          <div className="absolute top-4 left-4 bg-gold px-3.5 py-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
            {program.theme}
          </div>
        )}
        {program.destination_country && (
          <div className="absolute right-0 bottom-4 bg-ink/90 px-4 py-2 text-sm tracking-wide text-gold-pale">
            {program.destination_country}
          </div>
        )}
      </div>
      <div className="flex-1 p-6">
        <h3 className="font-display text-xl font-normal text-white">{program.title}</h3>
        {duration && (
          <p className="mt-3 text-sm text-white/65">
            {duration.days} jours / {duration.nights} nuits
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-gold/20 px-6 py-4">
        <span className="text-xs font-semibold tracking-widest text-gold uppercase">
          Découvrir
        </span>
        {program.starting_price && (
          <div className="text-right text-xs text-white/55">
            à partir de
            <div className="font-display text-lg text-gold">
              {program.starting_price} {program.currency}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
