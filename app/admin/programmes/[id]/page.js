import { notFound } from "next/navigation";
import Link from "next/link";
import { getProgramById, listTripsForProgram } from "@/lib/programsAdmin";
import { listAllFaqsForProgram } from "@/lib/programFaqs";
import { listDefaultHotelsForProgram } from "@/lib/programHotels";
import { listHotels } from "@/lib/hotels";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import ProgramForm from "../ProgramForm";
import TripsList from "./TripsList";
import ProgramFaqManager from "./ProgramFaqManager";

export default async function ProgramDetailPage({ params }) {
  const { id } = await params;

  const [program, trips, faqs, defaultHotels, hotels, session] = await Promise.all([
    getProgramById(id),
    listTripsForProgram(id),
    listAllFaqsForProgram(id),
    listDefaultHotelsForProgram(id),
    listHotels(),
    getSession(),
  ]);

  if (!program) {
    notFound();
  }

  const [canManagePrograms, canManageTrips] = await Promise.all([
    hasPermission(session, "programmes.manage"),
    hasPermission(session, "voyages.manage"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{program.title}</h1>

      <ProgramForm
        program={program}
        hotels={hotels}
        defaultHotelIds={defaultHotels.map((h) => h.id)}
        canDelete={canManagePrograms}
      />

      <div className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Voyages</h2>
          {canManageTrips && (
            <Link
              href={`/admin/programmes/${id}/voyages/new`}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              + Nouveau voyage
            </Link>
          )}
        </div>
        <TripsList trips={trips} canManage={canManageTrips} />
      </div>

      <div className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          FAQ (affichée sur la fiche publique du programme)
        </h2>
        <ProgramFaqManager
          programId={id}
          initialFaqs={faqs}
          canManage={canManagePrograms}
        />
      </div>
    </div>
  );
}
