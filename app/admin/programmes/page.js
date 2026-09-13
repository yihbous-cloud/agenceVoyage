import Link from "next/link";
import { listAllPrograms } from "@/lib/programsAdmin";
import { getSession } from "@/lib/session";

export default async function ProgrammesPage() {
  const [programs, session] = await Promise.all([listAllPrograms(), getSession()]);
  const canManage = session?.role === "direction";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Programmes</h1>
        {canManage && (
          <Link
            href="/admin/programmes/new"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            + Nouveau programme
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Voyages</th>
              <th className="px-4 py-3">Publié</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{p.title}</td>
                <td className="px-4 py-3 capitalize text-zinc-600">{p.program_type}</td>
                <td className="px-4 py-3 text-zinc-500">{p.slug}</td>
                <td className="px-4 py-3 text-zinc-600">{p.trips_count}</td>
                <td className="px-4 py-3">
                  {p.is_published ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Publié
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/programmes/${p.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {canManage ? "Modifier" : "Voir"}
                  </Link>
                </td>
              </tr>
            ))}
            {programs.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                  Aucun programme.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
