import Link from "next/link";
import { listAllNews } from "@/lib/news";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";

export default async function AdminNewsPage() {
  const [posts, session] = await Promise.all([listAllNews(), getSession()]);
  const canManage = await hasPermission(session, "actualites.manage");

  return (
    <div className="space-y-6">
      <PageHeader icon="newspaper" title="Actualités" description="Articles publiés sur le site.">
        {canManage && (
          <Link href="/admin/actualites/new" className="gf-btn-primary">
            <Icon name="add" size={19} />
            Nouvelle actualité
          </Link>
        )}
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-start text-sm">
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
                <td className="px-4 py-3 text-end">
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
