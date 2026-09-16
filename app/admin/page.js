import Link from "next/link";
import { getDashboardStats } from "@/lib/registrations";

export default async function AdminDashboard() {
  const { statusCounts, upcomingTrips } = await getDashboardStats();

  const countFor = (status) =>
    statusCounts.find((s) => s.status === status)?.count || 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["inscrit", "Inscrits"],
          ["confirme", "Confirmés"],
          ["paye_partiel", "Payé partiel"],
          ["paye_complet", "Payé complet"],
          ["annule", "Annulés"],
        ].map(([status, label]) => (
          <Link
            key={status}
            href={`/admin/inscriptions?status=${status}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50"
          >
            <p className="text-2xl font-bold text-zinc-900">{countFor(status)}</p>
            <p className="text-xs text-zinc-500">{label}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Prochains départs
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Inscrits / Places</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {upcomingTrips.map((trip) => (
                <tr key={trip.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">{trip.title}</td>
                  <td className="px-4 py-3">{trip.reference_code}</td>
                  <td className="px-4 py-3">
                    {new Date(trip.departure_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/inscriptions?tripId=${trip.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {trip.registered_count} / {trip.total_seats}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/voyages/${trip.id}/hebergement`}
                      className="text-emerald-700 hover:underline"
                    >
                      Hébergement
                    </Link>
                    {" · "}
                    <Link
                      href={`/admin/voyages/${trip.id}/listes`}
                      className="text-emerald-700 hover:underline"
                    >
                      Listes
                    </Link>
                  </td>
                </tr>
              ))}
              {upcomingTrips.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={5}>
                    Aucun départ à venir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
