import Link from "next/link";
import { listAllPrograms } from "@/lib/programsAdmin";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";

export default async function ProgrammesPage({ searchParams }) {
  const params = await searchParams;
  // Programme clôturé = tous ses voyages terminés/annulés ou passés
  // (lib/tripArchive.js) : archivé, séparé des programmes en cours.
  const view = params?.view === "archives" ? "archives" : "current";
  const [allPrograms, session] = await Promise.all([listAllPrograms(), getSession()]);
  const archivedPrograms = allPrograms.filter((p) => Boolean(Number(p.is_archived)));
  const currentPrograms = allPrograms.filter((p) => !Number(p.is_archived));
  const programs = view === "archives" ? archivedPrograms : currentPrograms;
  const [canManage, canCreateRegistration] = await Promise.all([
    hasPermission(session, "programmes.manage"),
    hasPermission(session, "inscriptions.create"),
  ]);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader icon="travel_explore" title="Programmes" description="Offres publiées sur le site et leurs voyages.">
        {canManage && (
          <Link href="/admin/programmes/new" className="gf-btn-primary">
            <Icon name="add" size={19} />
            Nouveau programme
          </Link>
        )}
      </PageHeader>

      <div className="gf-segmented self-start">
        <Link href="/admin/programmes" data-active={view === "current"} scroll={false}>
          <Icon name="travel_explore" size={16} />
          En cours
          <span className="gf-count">{currentPrograms.length}</span>
        </Link>
        <Link href="/admin/programmes?view=archives" data-active={view === "archives"} scroll={false}>
          <Icon name="inventory_2" size={16} />
          Archivés
          <span className="gf-count">{archivedPrograms.length}</span>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Famille</th>
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
                <td className="px-4 py-3 text-zinc-600">
                  {p.family === "omra_hajj" ? "Omra & Hajj" : "Voyage organisé"}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-600">{p.program_type}</td>
                <td className="px-4 py-3 text-zinc-500">{p.slug}</td>
                <td className="px-4 py-3 text-zinc-600">{p.trips_count}</td>
                <td className="px-4 py-3">
                  {Boolean(Number(p.is_archived)) ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                      Clôturé
                      {p.last_return_date &&
                        ` · ${new Date(p.last_return_date).toLocaleDateString("fr-FR")}`}
                    </span>
                  ) : p.is_published ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Publié
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    {canCreateRegistration && Number(p.open_trips_count) > 0 && (
                      <Link
                        href={`/admin/inscriptions/new?programId=${p.id}`}
                        className="gf-btn-primary"
                        style={{ height: 30, padding: "0 10px", fontSize: 12.5, borderRadius: 8 }}
                        title="Inscrire un voyageur au prochain départ de ce programme"
                      >
                        <Icon name="person_add" size={16} />
                        Inscrire
                      </Link>
                    )}
                    <Link href={`/admin/programmes/${p.id}`} className="gf-btn-outline" style={{ height: 30 }}>
                      <Icon name="edit" size={15} />
                      {canManage ? "Modifier" : "Voir"}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {programs.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                  {view === "archives" ? "Aucun programme archivé." : "Aucun programme en cours."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
