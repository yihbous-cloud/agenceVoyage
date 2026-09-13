import { notFound } from "next/navigation";
import { getProgramById } from "@/lib/programsAdmin";
import { listAirlines } from "@/lib/airlines";
import TripForm from "@/app/admin/voyages/TripForm";

export default async function NewTripPage({ params }) {
  const { id } = await params;

  const [program, airlines] = await Promise.all([getProgramById(id), listAirlines()]);

  if (!program) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Nouveau voyage</h1>
        <p className="text-sm text-zinc-500">{program.title}</p>
      </div>
      <TripForm programId={id} airlines={airlines} />
    </div>
  );
}
