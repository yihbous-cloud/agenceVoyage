import { listOpenTripsForSelect } from "@/lib/registrations";
import NewRegistrationForm from "./NewRegistrationForm";

export default async function NewRegistrationPage() {
  const trips = await listOpenTripsForSelect();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouvelle inscription</h1>
      <NewRegistrationForm trips={trips} />
    </div>
  );
}
