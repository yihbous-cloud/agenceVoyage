import Link from "next/link";
import { listAllNews } from "@/lib/news";
import { getSession } from "@/lib/session";

export default async function AdminNewsPage() {
  const [posts, session] = await Promise.all([listAllNews(), getSession()]);
  const canManage = session?.role === "direction";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Actualités</h1>
        {canManage && (
          <Link
            href="/admin/actualites/new"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            + Nouvelle actualité
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Publié</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{p.title}</td>
                <td className="px-4 py-3 text-zinc-500">{p.slug}</td>
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
                    href={`/admin/actualites/${p.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {canManage ? "Modifier" : "Voir"}
                  </Link>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={4}>
                  Aucune actualité.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
