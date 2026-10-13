import Image from "next/image";
import Link from "./LocalizedLink";
import RichText from "./RichText";
import VideoFacade from "./VideoFacade";
import TrackedContactLink from "./TrackedContactLink";
import { formatDate, computeDuration } from "./formatTrip";
import { findAirportByIata } from "@/lib/airportsReference";
import { getCityByIata } from "@/lib/airports";
import { normalizeDays, linesToList } from "@/lib/itineraryDays";
import { whatsappUrl } from "@/lib/contactLinks";

// Blocs de la fiche voyage (cahier référencement §6.4, vague 2A — CLAUDE.md
// §3centdixseptquadragies). Composants serveur : tout le contenu est dans le
// HTML (TECH-01). Un bloc sans donnée ne s'affiche pas. `tr` : traducteur
// public de la page (makeTranslator).

const GOLD = "text-[#A8863C]";
const ROOM_TYPES = ["double", "triple", "quadruple", "quintuple"];
const ROOM_LABELS = {
  double: "Chambre double",
  triple: "Chambre triple",
  quadruple: "Chambre quadruple",
  quintuple: "Chambre quintuple",
};
const BOARD_LABELS = {
  logement_seul: "Logement seul",
  petit_dejeuner: "Petit-déjeuner",
  demi_pension: "Demi-pension",
};

const SectionTitle = ({ children, id }) => (
  <h2 id={id} className="font-display text-xl font-normal text-ink">
    {children}
  </h2>
);

export function airportLabel(iata, tr) {
  if (!iata) return null;
  const city = findAirportByIata(iata)?.city || getCityByIata(iata)?.city;
  return city ? `${tr(city)} (${iata})` : iata;
}

// « 15 jours / 14 nuits » d'après les dates du départ.
export function durationLabel(trip, tr) {
  const duration = trip ? computeDuration(trip.departure_date, trip.return_date) : null;
  if (!duration) return null;
  return `${tr.plural("{count} jour", "{count} jours", duration.days)} / ${tr.plural(
    "{count} nuit",
    "{count} nuits",
    duration.nights
  )}`;
}

const formatMoney = (value, intlTag) =>
  Number(value).toLocaleString(intlTag, { maximumFractionDigits: 0 }).replace(/[  ]/g, " ");

const stars = (rating) => {
  const n = parseInt(String(rating || ""), 10);
  return n > 0 && n <= 5 ? `${"★".repeat(n)}${String(rating).includes("+") ? "+" : ""}` : null;
};

// --- Dans chaque départ ------------------------------------------------------

// Bloc « Vol » : compagnie, aéroports, escales, bagages.
export function TripFlight({ trip, tr }) {
  const rows = [];
  if (trip.airline_name) rows.push([tr("Compagnie aérienne"), trip.airline_name]);
  const outbound = trip.outbound_layover_iata
    ? tr("escale à {airport}", { airport: airportLabel(trip.outbound_layover_iata, tr) })
    : tr("vol direct");
  const back = trip.return_layover_iata
    ? tr("escale à {airport}", { airport: airportLabel(trip.return_layover_iata, tr) })
    : tr("vol direct");
  if (trip.origin_iata && trip.destination_iata) {
    rows.push([tr("Aller"), `${airportLabel(trip.origin_iata, tr)} → ${airportLabel(trip.destination_iata, tr)} · ${outbound}`]);
    const backFrom = trip.return_origin_iata || trip.destination_iata;
    const backTo = trip.return_destination_iata || trip.origin_iata;
    rows.push([tr("Retour"), `${airportLabel(backFrom, tr)} → ${airportLabel(backTo, tr)} · ${back}`]);
  }
  if (trip.baggage_allowance) rows.push([tr("Franchise bagages"), trip.baggage_allowance]);
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-ink">{tr("Vol")}</p>
      <dl className="mt-1 space-y-0.5 text-sm text-muted">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-1.5">
            <dt>{label} :</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Bloc « Hébergement » : hôtels dans l'ordre du séjour.
export function TripHotels({ trip, tr, intlTag }) {
  const hotels = trip.hotels || [];
  if (hotels.length === 0) {
    return trip.hotel_names ? (
      <p className="mt-4 text-sm text-muted">
        {tr("Hébergement")} : {trip.hotel_names}
      </p>
    ) : null;
  }
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-ink">{tr("Hébergement")}</p>
      <ul className="mt-2 space-y-3">
        {hotels.map((stay) => {
          const nights = computeDuration(stay.check_in_date, stay.check_out_date)?.nights;
          return (
            <li key={`${stay.hotel_name}-${stay.check_in_date}`} className="flex gap-3">
              {stay.photo_url && (
                <div className="relative h-16 w-24 shrink-0 overflow-hidden bg-cream">
                  <Image src={stay.photo_url} alt={stay.hotel_name} fill sizes="96px" className="object-cover" />
                </div>
              )}
              <div className="text-sm text-muted">
                <p className="text-ink">
                  {stay.hotel_name}
                  {stars(stay.star_rating) && <span className={`ms-1.5 ${GOLD}`}>{stars(stay.star_rating)}</span>}
                </p>
                <p>
                  {[
                    tr(stay.city),
                    nights ? tr.plural("{count} nuit", "{count} nuits", nights) : null,
                    stay.check_in_date ? `${formatDate(stay.check_in_date, intlTag)} – ${formatDate(stay.check_out_date, intlTag)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p>
                  {[
                    stay.landmark_distance_m != null
                      ? stay.landmark_name
                        ? tr("à {distance} m du {landmark}", { distance: stay.landmark_distance_m, landmark: tr(stay.landmark_name) })
                        : tr("à {distance} m", { distance: stay.landmark_distance_m })
                      : null,
                    stay.board_basis ? tr(BOARD_LABELS[stay.board_basis] || stay.board_basis) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Tableau comparatif des formules (cahier §8 : comparaison en tableau), ou
// des prix par type de chambre quand le départ n'a pas de formules.
export function TripPrices({ trip, tr, intlTag }) {
  const currency = tr(trip.currency || "MAD");
  const tiers = trip.tiers || [];
  const rows =
    tiers.length > 0
      ? tiers.map((tier) => ({ key: tier.id, label: tier.label, hotels: tier.hotels, prices: tier.prices }))
      : Object.keys(trip.room_prices || {}).length > 0
        ? [{ key: "prix", label: null, hotels: [], prices: trip.room_prices }]
        : [];
  const columns = ROOM_TYPES.filter((type) => rows.some((row) => row.prices?.[type] > 0));
  if (rows.length === 0 || columns.length === 0) return null;
  const price = (row, type) => (row.prices?.[type] > 0 ? `${formatMoney(row.prices[type], intlTag)} ${currency}` : "—");
  const hotelsLine = (row) => row.hotels.map((h) => `${tr(h.city)} : ${h.hotel_name}`).join(" · ");
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-ink">
        {tiers.length > 0 ? tr("Formules et prix par personne") : tr("Prix par personne selon la chambre")}
      </p>
      {/* Téléphone : une carte par formule (le tableau ne tient pas en largeur). */}
      <div className="mt-2 space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-gold-pale p-3">
            {row.label && <p className="font-medium text-ink">{row.label}</p>}
            {row.hotels?.length > 0 && <p className="text-xs text-muted">{hotelsLine(row)}</p>}
            <dl className="mt-2 space-y-1 text-sm">
              {columns.map((type) => (
                <div key={type} className="flex justify-between gap-3">
                  <dt className="text-muted">{tr(ROOM_LABELS[type])}</dt>
                  <dd className="whitespace-nowrap text-ink">{price(row, type)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gold-pale text-start text-xs text-muted">
            {tiers.length > 0 && <th className="py-2 pe-3 text-start font-medium">{tr("Formule")}</th>}
            {columns.map((type) => (
              <th key={type} className="py-2 pe-3 text-end font-medium">
                {tr(ROOM_LABELS[type])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-gold-pale/50 align-top">
              {tiers.length > 0 && (
                <td className="py-2 pe-3">
                  <span className="text-ink">{row.label}</span>
                  {row.hotels?.length > 0 && <span className="block text-xs text-muted">{hotelsLine(row)}</span>}
                </td>
              )}
              {columns.map((type) => (
                <td key={type} className="py-2 pe-3 text-end whitespace-nowrap text-ink">
                  {price(row, type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-1 text-xs text-muted">{tr("Prix TTC par personne, en dirhams.")}</p>
    </div>
  );
}

// --- Contenu du programme (commun à tous les départs) ------------------------

export function ItinerarySection({ program, tr }) {
  const days = normalizeDays(program.itinerary_days);
  if (!days && !program.supervision) return null;
  return (
    <section className="mt-10">
      <SectionTitle>{tr("Comment se déroule le voyage ?")}</SectionTitle>
      {days && (
        <ol className="mt-4 space-y-4 border-s border-gold-pale ps-5">
          {days.map((day, index) => (
            <li key={index}>
              <p className={`text-xs font-semibold tracking-wide uppercase ${GOLD}`}>
                {tr("Jour {n}", { n: index + 1 })}
              </p>
              {day.title && <h3 className="mt-0.5 font-medium text-ink">{day.title}</h3>}
              {day.description && <RichText className="mt-1 text-sm text-muted" text={day.description} />}
            </li>
          ))}
        </ol>
      )}
      {program.supervision && (
        <div className="mt-6 border border-gold-pale/60 bg-white p-5">
          <h3 className="font-medium text-ink">{tr("Encadrement")}</h3>
          <RichText className="mt-1 text-sm text-muted" text={program.supervision} />
        </div>
      )}
    </section>
  );
}

function MarkedList({ items, mark, tone }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm text-muted">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden="true" className={tone}>
            {mark}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function IncludedSection({ program, tr }) {
  const included = linesToList(program.included_items);
  const excluded = linesToList(program.excluded_items);
  if (included.length === 0 && excluded.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle>{tr("Que comprend le prix ?")}</SectionTitle>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {included.length > 0 && (
          <div>
            <h3 className="font-medium text-ink">{tr("Inclus")}</h3>
            <MarkedList items={included} mark="✓" tone="text-emerald-700" />
          </div>
        )}
        {excluded.length > 0 && (
          <div>
            <h3 className="font-medium text-ink">{tr("Non inclus")}</h3>
            <MarkedList items={excluded} mark="✕" tone="text-red-700" />
          </div>
        )}
      </div>
    </section>
  );
}

export function FormalitiesSection({ program, tr, intlTag }) {
  if (!program.formalities) return null;
  return (
    <section className="mt-10">
      <SectionTitle>{tr("Quels documents et formalités prévoir ?")}</SectionTitle>
      <RichText className="mt-3 text-sm text-muted" text={program.formalities} />
      {(program.formalities_verified_at || program.formalities_source_url) && (
        <p className="mt-3 text-xs text-muted">
          {program.formalities_verified_at && tr("Vérifié le {date}", { date: formatDate(program.formalities_verified_at, intlTag) })}
          {program.formalities_verified_at && program.formalities_source_url && " · "}
          {program.formalities_source_url && (
            <a href={program.formalities_source_url} target="_blank" rel="noopener noreferrer nofollow" className={`${GOLD} underline`}>
              {tr("Source officielle")}
            </a>
          )}
        </p>
      )}
    </section>
  );
}

export function ConditionsSection({ program, tr, hasCgv }) {
  if (!program.booking_conditions) return null;
  return (
    <section className="mt-10">
      <SectionTitle>{tr("Quelles sont les conditions de réservation et d'annulation ?")}</SectionTitle>
      <RichText className="mt-3 text-sm text-muted" text={program.booking_conditions} />
      {hasCgv && (
        <p className="mt-3 text-xs">
          <Link href="/conditions-generales-de-vente" className={`${GOLD} underline`}>
            {tr("Conditions générales de vente")}
          </Link>
        </p>
      )}
    </section>
  );
}

const captionFor = (media, locale) =>
  (locale === "ar" ? media.caption_ar || media.caption_fr : media.caption_fr || media.caption_ar) || null;

export function ProofSection({ media = [], reviews, tr, locale, intlTag }) {
  const photos = media.filter((m) => m.kind === "photo");
  const video = media.find((m) => m.kind === "video");
  const hasReviews = reviews?.count > 0;
  if (photos.length === 0 && !video && !hasReviews) return null;
  return (
    <section className="mt-10">
      <SectionTitle>{tr("Photos et avis de nos voyageurs")}</SectionTitle>
      {video && (
        <div className="mt-4">
          <VideoFacade url={video.url} title={captionFor(video, locale)} />
          {captionFor(video, locale) && <p className="mt-1 text-xs text-muted">{captionFor(video, locale)}</p>}
        </div>
      )}
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id}>
              <div className="relative aspect-[4/3] overflow-hidden bg-cream">
                <Image
                  src={photo.url}
                  alt={captionFor(photo, locale) || ""}
                  fill
                  sizes="(min-width: 640px) 280px, 50vw"
                  className="object-cover"
                />
              </div>
              {captionFor(photo, locale) && <figcaption className="mt-1 text-xs text-muted">{captionFor(photo, locale)}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {hasReviews && (
        <div className="mt-6">
          <p className="text-sm text-ink">
            <span className={`font-display text-2xl ${GOLD}`}>
              {String(reviews.average).replace(".", locale === "fr" ? "," : ".")}
            </span>{" "}
            / 5 · {tr.plural("{count} avis", "{count} avis", reviews.count)}
          </p>
          <ul className="mt-3 space-y-3">
            {reviews.reviews.map((review) => (
              <li key={review.id} className="border border-gold-pale/60 bg-white p-4">
                <p className={`${GOLD}`} aria-label={tr("Note : {rating} sur 5", { rating: review.rating })}>
                  {"★".repeat(review.rating)}
                  <span className="text-gold-pale">{"★".repeat(5 - review.rating)}</span>
                </p>
                <p className="mt-1 text-sm text-muted" lang={review.locale} dir={review.locale === "ar" ? "rtl" : "ltr"}>
                  {review.body}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {review.author_name}
                  {review.author_city ? ` · ${review.author_city}` : ""} · {formatDate(review.review_date, intlTag)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Bloc « Action » : réserver (départs), devis, WhatsApp. Sans interstitiel
// (TECH-20) : simples boutons dans le flux de la page.
export function ProgramActions({ program, whatsapp, hasTrips, tr, tripRef, className = "" }) {
  const whatsappLink = whatsapp
    ? whatsappUrl(whatsapp, tr("Bonjour, je souhaite des informations sur le programme « {title} ».", { title: program.title }))
    : null;
  const button = "inline-flex items-center justify-center px-5 py-2.5 text-xs font-medium tracking-wide uppercase";
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {hasTrips && (
        <a href="#departs" className={`${button} bg-gold text-ink hover:bg-gold-light`}>
          {tr("Réserver")}
        </a>
      )}
      <Link
        href={`/contact?sujet=${encodeURIComponent(tr("Devis : {title}", { title: program.title }))}`}
        className={`${button} border border-ink/30 text-ink hover:bg-white`}
      >
        {tr("Demander un devis")}
      </Link>
      {whatsappLink && (
        <TrackedContactLink
          kind="whatsapp"
          href={whatsappLink}
          tripRef={tripRef}
          className={`${button} bg-[#25D366] text-white hover:opacity-90`}
        >
          {tr("Écrire sur WhatsApp")}
        </TrackedContactLink>
      )}
    </div>
  );
}
