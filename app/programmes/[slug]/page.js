import { notFound } from "next/navigation";
import { getProgramBySlug, getOpenTripsForProgram } from "@/lib/programs";
import ReservationForm from "./ReservationForm";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug).catch(() => null);

  if (!program) {
    return { title: "Programme introuvable" };
  }

  return {
    title: program.meta_title || program.title,
    description: program.meta_description || program.short_description,
  };
}

export default async function ProgramPage({ params }) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug).catch(() => null);

  if (!program) {
    notFound();
  }

  const trips = await getOpenTripsForProgram(program.id).catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: program.title,
    description: program.short_description,
    image: program.cover_image_url || undefined,
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

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {program.program_type}
      </span>
      <h1 className="mt-2 text-3xl font-bold text-zinc-900">{program.title}</h1>
      <p className="mt-4 whitespace-pre-line text-zinc-700">
        {program.full_description || program.short_description}
      </p>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900">
        Prochains départs
      </h2>

      {trips.length === 0 && (
        <p className="mt-4 text-zinc-600">
          Aucun départ ouvert à la réservation pour le moment.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {trips.map((trip) => (
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
                </p>
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
        ))}
      </div>
    </main>
  );
}
