"use client";

import Link from "./LocalizedLink";
import Image from "next/image";
import { useLocale } from "./LocaleProvider";
import { SEASON_LABELS, formatDate, computeDuration } from "./formatTrip";
import { getCityByIata } from "@/lib/airports";
import { findAirportByIata } from "@/lib/airportsReference";

// Carte "vitrine" (habillage doré/sombre) utilisée sur l'accueil et sur tous
// les hubs publics (/omra-hajj, /voyages-organises, /villes-depart) pour une
// identité visuelle unique sur tout le site. Un seul composant,
// `program.family` pilote l'habillage, comme pour ProgramDetail.
export default function HomeShowcaseCard({ program }) {
  const { tr, intlTag, dir } = useLocale();
  const href =
    program.family === "omra_hajj"
      ? `/omra-hajj/${program.slug}`
      : `/voyages-organises/${program.slug}`;
  const duration = computeDuration(program.next_departure_date, program.next_return_date);
  const isOmraHajj = program.family === "omra_hajj";
  const durationLabel = duration
    ? `${tr.plural("{count} jour", "{count} jours", duration.days)} / ${tr.plural("{count} nuit", "{count} nuits", duration.nights)}`
    : "";

  // Nom complet de la ville de départ (aéroports marocains, lib/airports.js)
  // et de la ville d'arrivée (aller, destination_iata) — priorité à
  // destination_city (texte libre, §3novotrigies) puis à la référence
  // aéroports internationaux (lib/airportsReference.js, §3septtrigies),
  // repli sur le code IATA brut si aucune des deux ne le reconnaît.
  const originCityName = program.origin_iata
    ? tr(getCityByIata(program.origin_iata)?.city || program.origin_iata)
    : null;
  const destinationCityName =
    tr(
      program.destination_city ||
        (program.destination_iata
          ? findAirportByIata(program.destination_iata)?.city || program.destination_iata
          : "")
    ) || null;

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
            <div className="absolute top-5 -start-11 w-40 -rotate-45 bg-ink py-1.5 text-center text-[11px] font-semibold tracking-widest text-gold-pale uppercase">
              {tr(SEASON_LABELS[program.season] || program.season)}
            </div>
          )}
          {program.starting_price && (
            <div className="absolute end-0 bottom-0 bg-gold px-4 py-2 text-end font-display text-lg text-ink">
              <span className="block font-sans text-[10px] font-normal uppercase tracking-wide text-ink/70">
                {tr("à partir de")}
              </span>
              {program.starting_price} {tr(program.currency)}
            </div>
          )}
        </div>
        <div className="flex-1 p-6">
          <h3 className="font-display text-xl font-normal text-ink">{program.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-muted">
            {program.next_departure_date && (
              <p>
                {tr("Départ le {date}", { date: formatDate(program.next_departure_date, intlTag) })}
                {duration && ` · ${durationLabel}`}
              </p>
            )}
            {program.landmark_distance_m != null && (
              <p>
                {program.landmark_name
                  ? tr("À {distance} m du {landmark}", {
                      distance: program.landmark_distance_m,
                      landmark: tr(program.landmark_name),
                    })
                  : tr("À {distance} m", { distance: program.landmark_distance_m })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gold-pale/50 px-6 py-4 text-sm text-muted">
          <span>
            {originCityName && destinationCityName
              ? `${originCityName} ${dir === "rtl" ? "←" : "→"} ${destinationCityName}`
              : originCityName || " "}
          </span>
          {program.seats_remaining != null && (
            <span className="tracking-wide text-[#A8863C]">
              {tr.plural("{count} place restante", "{count} places restantes", program.seats_remaining)}
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
          <div className="absolute top-4 start-4 bg-gold px-3.5 py-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
            {tr(program.theme)}
          </div>
        )}
        {program.destination_country && (
          <div className="absolute end-0 bottom-4 bg-ink/90 px-4 py-2 text-sm tracking-wide text-gold-pale">
            {tr(program.destination_country)}
          </div>
        )}
      </div>
      <div className="flex-1 p-6">
        <h3 className="font-display text-xl font-normal text-white">{program.title}</h3>
        {duration && (
          <p className="mt-3 text-sm text-white/65">
            {durationLabel}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-gold/20 px-6 py-4">
        <span className="text-xs font-semibold tracking-widest text-gold uppercase">
          {tr("Découvrir")}
        </span>
        {program.starting_price && (
          <div className="text-end text-xs text-white/55">
            {tr("à partir de")}
            <div className="font-display text-lg text-gold">
              {program.starting_price} {tr(program.currency)}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
