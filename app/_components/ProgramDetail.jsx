import Image from "next/image";
import Link from "next/link";
import ReservationForm from "./ReservationForm";
import BreadcrumbJsonLd from "./BreadcrumbJsonLd";
import { SEASON_LABELS } from "./formatTrip";
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
}) {
  const isOmraHajj = family === "omra_hajj";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const hubHref = isOmraHajj ? "/omra-hajj" : "/voyages-organises";
  const hubLabel = isOmraHajj ? "Omra & Hajj" : "Voyages organisés";

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
      name: "Golden Fantastic",
    },
    offers: trips.map((trip) => ({
      "@type": "Offer",
      price: trip.price_per_person,
      priceCurrency: trip.currency,
      availability:
        trip.seats_remaining > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      validFrom: trip.departure_date,
    })),
  };

  const breadcrumbItems = [
    { name: "Accueil", item: baseUrl },
    { name: hubLabel, item: `${baseUrl}${hubHref}` },
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
      <div className="mx-auto max-w-4xl px-6 py-12">
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
          <div className="relative mb-6 h-64 w-full overflow-hidden">
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
              {SEASON_LABELS[program.season] || program.season}
            </span>
          )}
          {!isOmraHajj && program.theme && (
            <span className="bg-gold px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
              {program.theme}
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-[#A8863C]">
            {program.program_type}
          </span>
        </div>

        <h1 className="mt-3 font-display text-3xl font-normal text-ink">
          {program.title}
        </h1>
        <p className="mt-4 whitespace-pre-line text-muted">
          {program.full_description || program.short_description}
        </p>

        <h2 className="mt-10 font-display text-xl font-normal text-ink">
          Prochains départs
        </h2>

        {trips.length === 0 && (
          <p className="mt-4 text-muted">
            Aucun départ ouvert à la réservation pour le moment.
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
                      {new Date(trip.departure_date).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(trip.return_date).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="text-sm text-muted">
                      Réf. {trip.reference_code}
                      {trip.airline_name ? ` · ${trip.airline_name}` : ""}
                      {trip.origin_iata && (
                        <>
                          {" · Départ "}
                          {city ? (
                            <Link
                              href={`/villes-depart/${citySlug(city.city)}`}
                              className="text-[#A8863C] hover:underline"
                            >
                              {city.city} ({trip.origin_iata})
                            </Link>
                          ) : (
                            trip.origin_iata
                          )}
                        </>
                      )}
                    </p>
                    {isOmraHajj && trip.hotel_names && (
                      <p className="text-sm text-muted">
                        Hébergement : {trip.hotel_names}
                        {trip.min_landmark_distance_m != null &&
                          ` (à ${trip.min_landmark_distance_m} m${
                            trip.nearest_landmark_name ? ` du ${trip.nearest_landmark_name}` : ""
                          })`}
                      </p>
                    )}
                  </div>
                  <p className="font-display text-lg text-[#A8863C]">
                    {trip.price_per_person} {trip.currency}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {trip.seats_remaining > 0
                    ? `${trip.seats_remaining} places restantes`
                    : "Complet"}
                </p>
                {trip.seats_remaining > 0 && <ReservationForm tripId={trip.id} />}
              </div>
            );
          })}
        </div>

        {faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-normal text-ink">
              Questions fréquentes
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
