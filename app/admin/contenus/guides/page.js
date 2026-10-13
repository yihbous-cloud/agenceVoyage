import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllGuides } from "@/lib/guides";
import { translationStatus } from "@/lib/contentTranslations";
import { GUIDE_PILLAR_LABELS } from "@/lib/editorial";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";

export const dynamic = "force-dynamic";

// Guides de l'outil éditorial (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies).
export default async function GuidesPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "contenus.manage"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const guides = await listAllGuides();
  const languages = await translationStatus("guide", guides);
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="article"
        title="Guides"
        description="Articles de fond publiés sous /guide : formalités, rites, santé, conseils. Un guide religieux n'est publié qu'après relecture par un référent religieux."
      >
        <Link href="/admin/contenus/guides/new" className="gf-btn-primary">
          <Icon name="add" size={19} />
          Nouveau guide
        </Link>
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Pilier</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Relu le</th>
              <th className="px-4 py-3">Langues</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => {
              const reviewed = g.reviewed_at ? String(g.reviewed_at).slice(0, 10) : null;
              return (
                <tr key={g.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900" translate="no" dir="auto">
                      {g.title}
                    </div>
                    <div className="text-xs text-zinc-500" translate="no">
                      /guide/{g.slug}
                    </div>
                    {Boolean(g.is_religious) && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Contenu religieux</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{GUIDE_PILLAR_LABELS[g.pillar]}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {g.author_name ? <span translate="no">{g.author_name}</span> : <span className="text-amber-700">Sans auteur</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {reviewed ? (
                      <span className={reviewed < sixMonthsAgo ? "text-amber-700" : ""}>{reviewed}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {["ar", "fr"].map((loc) => {
                      const ok = (languages[g.id] || []).includes(loc);
                      return (
                        <span
                          key={loc}
                          translate="no"
                          className={`me-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            ok ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          {loc.toUpperCase()} {ok ? "✓" : "—"}
                        </span>
                      );
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {g.status === "publie" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Publié</span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">Brouillon</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/admin/contenus/guides/${g.id}`} className="text-emerald-700 hover:underline">
                      Modifier
                    </Link>
                  </td>
                </tr>
              );
            })}
            {guides.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={7}>
                  Aucun guide. Commencez par créer les auteurs (et le référent religieux), puis rédigez votre premier guide.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
