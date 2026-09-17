"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_STYLES = {
  planifie: "bg-zinc-100 text-zinc-700",
  ouvert: "bg-emerald-100 text-emerald-700",
  complet: "bg-amber-100 text-amber-700",
  en_cours: "bg-blue-100 text-blue-700",
  termine: "bg-zinc-200 text-zinc-600",
  annule: "bg-red-100 text-red-700",
};

export default function TripsList({ trips, canManage }) {
  const router = useRouter();

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce voyage ?")) return;
    const res = await fetch(`/api/admin/trips/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500">
          <tr>
            <th className="px-4 py-3">Référence</th>
            <th className="px-4 py-3">Départ</th>
            <th className="px-4 py-3">Compagnie</th>
            <th className="px-4 py-3">Inscrits / Places</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100 last:border-0">
              <td className="px-4 py-3 font-medium text-zinc-900">{t.reference_code}</td>
              <td className="px-4 py-3">
                {new Date(t.departure_date).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-zinc-600">{t.airline_name || "—"}</td>
              <td className="px-4 py-3">
                {t.registrations_count} / {t.total_seats}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    STATUS_STYLES[t.status] || "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right space-x-3">
                <Link
                  href={`/admin/voyages/${t.id}`}
                  className="text-emerald-700 hover:underline"
                >
                  Modifier
                </Link>
                {canManage && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
          {trips.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                Aucun voyage pour ce programme — le prix et les dates se
                définissent par voyage (un même programme peut avoir plusieurs
                départs à des prix différents), pas sur le programme lui-même.
                Cliquez sur « + Nouveau voyage » ci-dessus pour en ajouter un ;
                tant qu&apos;aucun voyage n&apos;existe, ce programme n&apos;est
                pas réservable et n&apos;apparaît pas dans le formulaire
                d&apos;inscription.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
