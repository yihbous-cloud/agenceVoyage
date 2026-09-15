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
  visaTypes = [],
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
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
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
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-xl">
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
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {SEASON_LABELS[program.season] || program.season}
          </span>
        )}
        {!isOmraHajj && program.theme && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            {program.theme}
          </span>
        )}
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            isOmraHajj ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {program.program_type}
        </span>
      </div>

      <h1 className="mt-2 text-3xl font-bold text-zinc-900">{program.title}</h1>
      <p className="mt-4 whitespace-pre-line text-zinc-700">
        {program.full_description || program.short_description}
      </p>

      {isOmraHajj && visaTypes.length > 0 && (
        <section className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Visa et documents à prévoir
          </h2>
          <ul className="mt-3 space-y-3">
            {visaTypes.map((vt) => (
              <li key={vt.id} className="text-sm text-zinc-700">
                <p className="font-medium text-zinc-900">
                  {vt.name} — {vt.price} MAD
                </p>
                {vt.documents?.length > 0 && (
                  <ul className="ml-4 mt-1 list-disc text-zinc-600">
                    {vt.documents.map((doc) => (
                      <li key={doc.id}>{doc.document_name}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-10 text-xl font-semibold text-zinc-900">
        Prochains départs
      </h2>

      {trips.length === 0 && (
        <p className="mt-4 text-zinc-600">
          Aucun départ ouvert à la réservation pour le moment.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {trips.map((trip) => {
          const city = trip.origin_iata ? getCityByIata(trip.origin_iata) : null;
          return (
            <div
              key={trip.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900">
                    {new Date(trip.departure_date).toLocaleDateString("fr-FR")} →{" "}
                    {new Date(trip.return_date).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-sm text-zinc-600">
                    Réf. {trip.reference_code}
                    {trip.airline_name ? ` · ${trip.airline_name}` : ""}
                    {trip.origin_iata && (
                      <>
                        {" · Départ "}
                        {city ? (
                          <Link
                            href={`/villes-depart/${citySlug(city.city)}`}
                            className="text-emerald-700 hover:underline"
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
                    <p className="text-sm text-zinc-500">
                      Hébergement : {trip.hotel_names}
                      {trip.min_distance_to_haram_m != null &&
                        ` (à ${trip.min_distance_to_haram_m} m de la Haram)`}
                    </p>
                  )}
                </div>
                <p className="text-lg font-bold text-emerald-700">
                  {trip.price_per_person} {trip.currency}
                </p>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
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
          <h2 className="text-xl font-semibold text-zinc-900">
            Questions fréquentes
          </h2>
          <div className="mt-4 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="rounded-xl border border-zinc-200 bg-white p-5"
              >
                <h3 className="font-medium text-zinc-900">{faq.question}</h3>
                <p className="mt-2 text-sm whitespace-pre-line text-zinc-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
