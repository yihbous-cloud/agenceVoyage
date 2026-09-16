import { notFound } from "next/navigation";
import Link from "next/link";
import { getTripFullById } from "@/lib/programsAdmin";
import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import TripForm from "../TripForm";

export default async function EditTripPage({ params }) {
  const { tripId } = await params;

  const [trip, airlines, session] = await Promise.all([
    getTripFullById(tripId),
    listAirlines(),
    getSession(),
  ]);

  if (!trip) {
    notFound();
  }

  const canManage = await hasPermission(session, "voyages.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{trip.reference_code}</h1>
        <p className="text-sm text-zinc-500">
          {trip.program_title}
          {" · "}
          <Link href={`/admin/voyages/${tripId}/hebergement`} className="text-emerald-700 hover:underline">
            Hébergement
          </Link>
          {" · "}
          <Link href={`/admin/voyages/${tripId}/listes`} className="text-emerald-700 hover:underline">
            Listes
          </Link>
          {" · "}
          <Link href={`/admin/voyages/${tripId}/billets`} className="text-emerald-700 hover:underline">
            Billets d&apos;avion
          </Link>
          {" · "}
          <Link href={`/admin/inscriptions?tripId=${tripId}`} className="text-emerald-700 hover:underline">
            Inscrits
          </Link>
        </p>
      </div>
      <TripForm trip={trip} airlines={airlines} canDelete={canManage} />
    </div>
  );
}
