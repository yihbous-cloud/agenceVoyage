import Image from "next/image";
import Link from "./LocalizedLink";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS } from "@/lib/i18n/locales";
import ReservationForm from "./ReservationForm";
import Breadcrumbs from "./Breadcrumbs";
import RichText from "./RichText";
import PageJsonLd from "./PageJsonLd";
import HomeShowcaseCard from "./HomeShowcaseCard";
import { SEASON_LABELS, formatDate } from "./formatTrip";
import { getCityByIata, citySlug } from "@/lib/airports";
import { programPath, pillarPath, programPillar, PILLAR_LABELS } from "@/lib/programUrls";
import { plainSummary } from "@/lib/markdown";
import { touristTripNode, faqNode, videoObjectNode, productNode } from "@/lib/seo/jsonLd";
import { youtubeId, youtubeThumbnail, youtubeEmbedUrl } from "@/lib/videoUrls";
import {
  TripFlight,
  TripHotels,
  TripPrices,
  ItinerarySection,
  IncludedSection,
  FormalitiesSection,
  ConditionsSection,
  ProofSection,
  ProgramActions,
  durationLabel,
} from "./ProgramBlocks";

// Prix à 0 = palier jamais saisi dans l'admin : jamais affiché ni balisé
// (une offre à 0 MAD dans le JSON-LD serait fausse).
const hasPrice = (trip) => Number(trip.starting_price) > 0;

// Gabarit de détail partagé par /omra/[slug], /hajj/[slug] et
// /voyages-organises/[slug] (app/_components/programPage.js).
// Un seul composant technique : `family` pilote uniquement l'habillage
// (ton spirituel vs ton évasion) et le contenu mis en avant, jamais le
// moteur de réservation (identique pour les deux familles, cf. ReservationForm).
//
// Fiche en 10 blocs (cahier référencement §6.4, vague 2A — CLAUDE.md
// §3centdixseptquadragies) : en-tête + actions, départs (vol, hébergement,
// formules), programme jour par jour, inclus / non inclus, formalités,
// conditions, preuves (photos, vidéo, avis), FAQ, actions finales. Un bloc
// sans donnée n'est pas affiché.
export default function ProgramDetail({
  program,
  trips,
  family,
  faqs = [],
  locale,
  agency, // { id, name, subdomain } — multi-agences (CLAUDE.md §3sexvicies)
  canonicalLocale, // langue de l'URL canonique (contenu saisi dans une seule langue)
  pastTrips = [], // départs terminés (TECH-09), seulement s'il n'y a plus de départ ouvert
  successor = null, // « Prochaine édition » désignée dans l'admin
  suggestions = [], // sinon : autres programmes du même pilier avec un départ ouvert
  media = [], // photos et vidéo (bloc Preuves)
  reviews = null, // avis publiés : { reviews, average, count }
  contact = {}, // { whatsapp, hasCgv } — coordonnées de l'agence
}) {
  const tr = makeTranslator(locale, "public", { brandName: agency?.name });
  const intlTag = INTL_TAGS[locale];
  const isOmraHajj = family === "omra_hajj";
  const breadcrumb = [
    { name: tr("Accueil"), href: "/" },
    { name: tr(PILLAR_LABELS[programPillar(program)]), href: pillarPath(program) },
    { name: program.title },
  ];
  const ended = trips.length === 0 && pastTrips.length > 0;
  const nextPrograms = successor ? [successor] : suggestions;
  const nextTrip = trips[0] || null;
  const pricedTrips = trips.filter(hasPrice);
  const minPrice = pricedTrips.length > 0 ? Math.min(...pricedTrips.map((t) => Number(t.starting_price))) : null;
  const photos = media.filter((m) => m.kind === "photo");
  const video = media.find((m) => m.kind === "video") || null;
  const videoId = video ? youtubeId(video.url) : null;
  const videoCaption = video ? (locale === "ar" ? video.caption_ar || video.caption_fr : video.caption_fr || video.caption_ar) : null;

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Un seul bloc JSON-LD : organisation, site, page, fil d'Ariane,
            voyage (offres + itinéraire hôtel par hôtel), FAQ, vidéo, avis. */}
        <PageJsonLd
          agency={agency}
          locale={locale}
          path={programPath(program)}
          canonicalLocale={canonicalLocale}
          name={program.meta_title || program.title}
          description={program.meta_description || plainSummary(program.short_description || program.full_description)}
          pageType="ItemPage"
          breadcrumb={breadcrumb}
          mainEntity="trip"
          dateModified={program.updated_at}
          nodes={(url, baseUrl) => [
            touristTripNode({ program, trips, url, baseUrl, photos }),
            faqNode(url, faqs),
            videoId
              ? videoObjectNode({
                  video: { ...video, caption: videoCaption },
                  program,
                  url,
                  thumbnailUrl: youtubeThumbnail(videoId),
                  embedUrl: youtubeEmbedUrl(videoId),
                })
              : null,
            productNode({ program, trips, url, baseUrl, photos, reviews }),
          ]}
        />
        <Breadcrumbs className="mb-6" locale={locale} label={tr("Fil d'Ariane")} items={breadcrumb} />

        {!isOmraHajj && program.cover_image_url && (
          <div className="relative mb-6 h-48 w-full overflow-hidden sm:h-64">
            <Image
              src={program.cover_image_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isOmraHajj && program.season && (
            <span className="bg-gold px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
              {tr(SEASON_LABELS[program.season] || program.season)}
            </span>
          )}
          {!isOmraHajj && program.theme && (
            <span className="bg-gold px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
              {tr(program.theme)}
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-[#A8863C]">
            {tr(program.program_type)}
          </span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-normal text-ink sm:text-3xl">
          {program.title}
        </h1>

        {/* Bloc 1 — en-tête : l'essentiel de l'offre en premier (cahier §6.3). */}
        {nextTrip && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-gold-pale/60 py-4 text-sm sm:grid-cols-4">
            {durationLabel(nextTrip, tr) && (
              <div>
                <dt className="text-xs text-muted">{tr("Durée")}</dt>
                <dd className="text-ink">{durationLabel(nextTrip, tr)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted">{tr("Prochain départ")}</dt>
              <dd className="text-ink">{formatDate(nextTrip.departure_date, intlTag)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{tr("à partir de")}</dt>
              <dd className="font-display text-lg text-[#A8863C]">
                {minPrice ? `${minPrice} ${tr(nextTrip.currency || "MAD")} ${tr("TTC")}` : tr("Prix sur demande")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{tr("Places")}</dt>
              <dd className="text-ink">
                {nextTrip.seats_remaining > 0
                  ? tr.plural("{count} place restante", "{count} places restantes", nextTrip.seats_remaining)
                  : tr("Complet")}
              </dd>
            </div>
          </dl>
        )}
        <ProgramActions
          className="mt-4"
          program={program}
          whatsapp={contact.whatsapp}
          hasTrips={trips.length > 0}
          tr={tr}
          tripRef={nextTrip?.reference_code}
        />

        <RichText className="mt-6 text-muted" text={program.full_description || program.short_description} />
        {program.updated_at && (
          <p className="mt-3 text-xs text-muted">
            {tr("Mis à jour le {date}", { date: formatDate(program.updated_at, intlTag) })}
          </p>
        )}

        <h2 id="departs" className="mt-10 scroll-mt-24 font-display text-xl font-normal text-ink">
          {tr("Prochains départs")}
        </h2>

        {trips.length === 0 && !ended && (
          <p className="mt-4 text-muted">
            {tr("Aucun départ ouvert à la réservation pour le moment.")}
          </p>
        )}

        {/* TECH-09 : un programme dont tous les départs sont passés reste
            en ligne (jamais de 404) et oriente vers la suite. */}
        {ended && (
          <div className="mt-4 border border-gold-pale/60 bg-white p-6">
            <p className="font-semibold text-ink">{tr("Départ terminé")}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {pastTrips.map((trip) => (
                <li key={trip.id}>
                  {formatDate(trip.departure_date, intlTag)} – {formatDate(trip.return_date, intlTag)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              {nextPrograms.length > 0
                ? tr("Ce programme est terminé. Découvrez nos prochains départs ci-dessous.")
                : tr("Ce programme est terminé. Contactez-nous pour connaître la prochaine édition.")}
            </p>
          </div>
        )}

        {trips.length === 0 && nextPrograms.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-normal text-ink">
              {successor ? tr("Prochaine édition") : tr("Nos prochains départs")}
            </h2>
            <div className="mt-6 grid gap-7 sm:grid-cols-2">
              {nextPrograms.map((next) => (
                <HomeShowcaseCard key={next.id} program={next} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 space-y-4">
          {trips.map((trip) => {
            const city = trip.origin_iata ? getCityByIata(trip.origin_iata) : null;
            const duration = durationLabel(trip, tr);
            return (
              <div key={trip.id} className="border border-gold-pale/60 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {formatDate(trip.departure_date, intlTag)} –{" "}
                      {formatDate(trip.return_date, intlTag)}
                      {duration && <span className="ms-2 text-sm font-normal text-muted">({duration})</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {tr("Réf.")} {trip.reference_code}
                      {trip.origin_iata && (
                        <>
                          {` · ${tr("Départ")} `}
                          {city ? (
                            <Link
                              href={`/villes-depart/${citySlug(city.city)}`}
                              className="text-[#A8863C] hover:underline"
                            >
                              {tr(city.city)} ({trip.origin_iata})
                            </Link>
                          ) : (
                            trip.origin_iata
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  {hasPrice(trip) ? (
                    <p className="mt-2 font-display text-lg text-[#A8863C] sm:mt-0">
                      <span className="block text-xs font-sans text-muted">{tr("à partir de")}</span>
                      {trip.starting_price} {tr(trip.currency)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted sm:mt-0">{tr("Prix sur demande")}</p>
                  )}
                </div>

                {/* Blocs 2 et 3 — vol, hébergement, formules (propres au départ). */}
                <TripFlight trip={trip} tr={tr} />
                {(isOmraHajj || trip.hotels?.length > 0) && <TripHotels trip={trip} tr={tr} intlTag={intlTag} />}
                <TripPrices trip={trip} tr={tr} intlTag={intlTag} />

                {trip.meal_offers?.length > 0 && (
                  <div className="mt-4 text-sm text-muted">
                    <p className="font-medium text-ink">{tr("Restauration")}</p>
                    <ul className="mt-1 space-y-1">
                      {trip.meal_offers.map((offer) => (
                        <li key={offer.id}>
                          <span className="text-ink">{offer.title}</span>
                          {offer.description && ` — ${offer.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-sm text-muted">
                  {trip.seats_remaining > 0
                    ? tr.plural("{count} place restante", "{count} places restantes", trip.seats_remaining)
                    : tr("Complet")}
                </p>
                {trip.seats_remaining > 0 && <ReservationForm tripId={trip.id} tripRef={trip.reference_code} />}
              </div>
            );
          })}
        </div>

        {/* Blocs 4 à 8 — contenu commun à tous les départs du programme. */}
        <ItinerarySection program={program} tr={tr} />
        <IncludedSection program={program} tr={tr} />
        <FormalitiesSection program={program} tr={tr} intlTag={intlTag} />
        <ConditionsSection program={program} tr={tr} hasCgv={contact.hasCgv} />
        <ProofSection media={media} reviews={reviews} tr={tr} locale={locale} intlTag={intlTag} />

        {/* Bloc 9 — FAQ. */}
        {faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-normal text-ink">
              {tr("Questions fréquentes")}
            </h2>
            <div className="mt-4 space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="border border-gold-pale/60 bg-white p-5">
                  <h3 className="font-medium text-ink">{faq.question}</h3>
                  <p className="mt-2 text-sm whitespace-pre-line text-muted">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bloc 10 — action. */}
        <section className="mt-10 border border-gold-pale/60 bg-white p-6">
          <h2 className="font-display text-xl font-normal text-ink">{tr("Une question sur ce voyage ?")}</h2>
          <p className="mt-1 text-sm text-muted">
            {tr("Notre équipe vous répond sur WhatsApp, par téléphone ou par le formulaire de devis.")}
          </p>
          <ProgramActions
            className="mt-4"
            program={program}
            whatsapp={contact.whatsapp}
            hasTrips={trips.length > 0}
            tr={tr}
            tripRef={nextTrip?.reference_code}
          />
        </section>
      </div>
    </main>
  );
}
