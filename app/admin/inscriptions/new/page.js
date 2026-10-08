import { listOpenTripsForSelect } from "@/lib/registrations";
import NewRegistrationForm from "./NewRegistrationForm";

// ?tripId=X (bouton « Inscrire » d'un départ) ou ?programId=Y (bouton
// « Inscrire » d'un programme : son prochain voyage ouvert) pré-sélectionnent
// le voyage — prix, tarifs d'hébergement et contrôle du passeport (6 mois
// après le départ) se remplissent alors automatiquement.
function pickInitialTrip(trips, { tripId, programId }) {
  if (tripId) {
    const trip = trips.find((t) => String(t.id) === String(tripId));
    if (trip) return trip.id;
  }
  if (programId) {
    const today = new Date().toISOString().slice(0, 10);
    const ofProgram = trips.filter((t) => String(t.program_id) === String(programId));
    const upcoming = ofProgram.find((t) => String(t.departure_date).slice(0, 10) >= today);
    return (upcoming || ofProgram[0])?.id ?? null;
  }
  return null;
}

export default async function NewRegistrationPage({ searchParams }) {
  const params = await searchParams;
  const trips = await listOpenTripsForSelect();
  const initialTripId = pickInitialTrip(trips, { tripId: params?.tripId, programId: params?.programId });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouvelle inscription</h1>
      <NewRegistrationForm trips={trips} initialTripId={initialTripId} />
    </div>
  );
}
