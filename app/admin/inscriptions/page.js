import Link from "next/link";
import { listRegistrations } from "@/lib/registrations";

const STATUS_LABELS = {
  inscrit: "Inscrit",
  confirme: "Confirmé",
  paye_partiel: "Payé partiel",
  paye_complet: "Payé complet",
  annule: "Annulé",
};

const STATUS_STYLES = {
  inscrit: "bg-zinc-100 text-zinc-700",
  confirme: "bg-blue-100 text-blue-700",
  paye_partiel: "bg-amber-100 text-amber-700",
  paye_complet: "bg-emerald-100 text-emerald-700",
  annule: "bg-red-100 text-red-700",
};

export default async function InscriptionsPage({ searchParams }) {
  const params = await searchParams;
  const tripId = params?.tripId || undefined;
  const status = params?.status || undefined;

  const registrations = await listRegistrations({ tripId, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Inscrits</h1>
        <Link
          href="/admin/inscriptions/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Nouvelle inscription
        </Link>
      </div>

      {tripId && (
        <p className="text-sm text-zinc-500">
          Filtré par voyage #{tripId} —{" "}
          <Link href="/admin/inscriptions" className="text-emerald-700 hover:underline">
            réinitialiser
          </Link>
          {" · "}
          <Link
            href={`/admin/voyages/${tripId}/hebergement`}
            className="text-emerald-700 hover:underline"
          >
            gérer l&apos;hébergement
          </Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Voyageur</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3">Voyage</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Visa</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg) => (
              <tr key={reg.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {reg.full_name}
                </td>
                <td className="px-4 py-3 text-zinc-600">{reg.phone_whatsapp}</td>
                <td className="px-4 py-3 text-zinc-600">{reg.program_title}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {reg.reference_code}
                  <br />
                  <span className="text-xs text-zinc-400">
                    {new Date(reg.departure_date).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      STATUS_STYLES[reg.status] || "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {STATUS_LABELS[reg.status] || reg.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 capitalize">
                  {reg.visa_status.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/inscriptions/${reg.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
            {registrations.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                  Aucune inscription.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
