import { notFound } from "next/navigation";
import Link from "next/link";
import { getProgramById, listTripsForProgram } from "@/lib/programsAdmin";
import { getSession } from "@/lib/session";
import ProgramForm from "../ProgramForm";
import TripsList from "./TripsList";

export default async function ProgramDetailPage({ params }) {
  const { id } = await params;

  const [program, trips, session] = await Promise.all([
    getProgramById(id),
    listTripsForProgram(id),
    getSession(),
  ]);

  if (!program) {
    notFound();
  }

  const canManage = session?.role === "direction";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{program.title}</h1>

      <ProgramForm program={program} canDelete={canManage} />

      <div className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Voyages</h2>
          {canManage && (
            <Link
              href={`/admin/programmes/${id}/voyages/new`}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              + Nouveau voyage
            </Link>
          )}
        </div>
        <TripsList trips={trips} canManage={canManage} />
      </div>
    </div>
  );
}
