import Image from "next/image";
import Link from "./LocalizedLink";
import { siteBaseUrl } from "@/lib/i18n/seo";
import { makeTranslator } from "@/lib/i18n/translate";
import { INTL_TAGS, localizePath } from "@/lib/i18n/locales";
import ReservationForm from "./ReservationForm";
import BreadcrumbJsonLd from "./BreadcrumbJsonLd";
import { SEASON_LABELS, formatDate } from "./formatTrip";
import { getCityByIata, citySlug } from "@/lib/airports";

// Gabarit de détail partagé par /omra-hajj/[slug] et /voyages-organises/[slug].
// Un seul composant technique : `family` pilote uniquement l'habillage
// (ton spirituel vs ton évasion) et le contenu mis en avant, jamais le
// moteur de réservation (identique pour les deux familles, cf. ReservationForm).
export default function ProgramDetail({
  program,
  trips,
  family,
  faqs = [],
  locale,
  agency, // { id, name, subdomain } — multi-agences (CLAUDE.md §3sexvicies)
}) {
  const tr = makeTranslator(locale, "public", { brandName: agency?.name });
  const intlTag = INTL_TAGS[locale];
  const isOmraHajj = family === "omra_hajj";
  const baseUrl = siteBaseUrl(agency?.subdomain);
  const hubHref = isOmraHajj ? "/omra-hajj" : "/voyages-organises";
  const hubLabel = tr(isOmraHajj ? "Omra & Hajj" : "Voyages organisés");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: program.title,
    description: program.short_description,
    image: program.cover_image_url || undefined,
    datePublished: program.created_at,
    dateModified: program.updated_at,
    provider: {
      "@type": "TravelAgency",
      name: agency?.name || "Golden Fantastic",
    },
    offers: trips.map((trip) => ({
      "@type": "Offer",
      price: trip.starting_price,
      priceCurrency: trip.currency,
      availability:
        trip.seats_remaining > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      validFrom: trip.departure_date,
    })),
  };

  const breadcrumbItems = [
    { name: tr("Accueil"), item: `${baseUrl}${localizePath("/", locale)}` },
    { name: hubLabel, item: `${baseUrl}${localizePath(hubHref, locale)}` },
    { name: program.title },
  ];

  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <main className="flex-1 bg-cream">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <BreadcrumbJsonLd items={breadcrumbItems} />
        {faqJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        )}

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
        <p className="mt-4 whitespace-pre-line text-muted">
          {program.full_description || program.short_description}
        </p>

        <h2 className="mt-10 font-display text-xl font-normal text-ink">
          {tr("Prochains départs")}
        </h2>

        {trips.length === 0 && (
          <p className="mt-4 text-muted">
            {tr("Aucun départ ouvert à la réservation pour le moment.")}
          </p>
        )}

        <div className="mt-6 space-y-4">
          {trips.map((trip) => {
            const city = trip.origin_iata ? getCityByIata(trip.origin_iata) : null;
            return (
              <div key={trip.id} className="border border-gold-pale/60 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {formatDate(trip.departure_date, intlTag)} –{" "}
                      {formatDate(trip.return_date, intlTag)}
                    </p>
                    <p className="text-sm text-muted">
                      {tr("Réf.")} {trip.reference_code}
                      {trip.airline_name ? ` · ${trip.airline_name}` : ""}
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
                    {isOmraHajj && trip.hotel_names && (
                      <p className="text-sm text-muted">
                        {tr("Hébergement")} : {trip.hotel_names}
                        {trip.min_landmark_distance_m != null &&
                          ` (${
                            trip.nearest_landmark_name
                              ? tr("à {distance} m du {landmark}", {
                                  distance: trip.min_landmark_distance_m,
                                  landmark: tr(trip.nearest_landmark_name),
                                })
                              : tr("à {distance} m", { distance: trip.min_landmark_distance_m })
                          })`}
                      </p>
                    )}
                    {trip.meal_offers?.length > 0 && (
                      <div className="mt-2 text-sm text-muted">
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
                  </div>
                  <p className="mt-2 font-display text-lg text-[#A8863C] sm:mt-0">
                    <span className="block text-xs font-sans text-muted">{tr("à partir de")}</span>
                    {trip.starting_price} {tr(trip.currency)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {trip.seats_remaining > 0
                    ? tr.plural("{count} place restante", "{count} places restantes", trip.seats_remaining)
                    : tr("Complet")}
                </p>
                {trip.seats_remaining > 0 && <ReservationForm tripId={trip.id} />}
              </div>
            );
          })}
        </div>

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
      </div>
    </main>
  );
}
