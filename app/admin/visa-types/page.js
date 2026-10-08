import Link from "next/link";
import { listVisaTypes } from "@/lib/visaTypes";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";

export default async function VisaTypesPage() {
  const visaTypes = await listVisaTypes();

  return (
    <div className="space-y-6">
      <PageHeader icon="badge" title="Types de visa" description="Catalogue des visas proposés et leurs tarifs.">
        <Link href="/admin/visa-types/new" className="gf-btn-primary">
            <Icon name="add" size={19} />
            Nouveau type de visa
          </Link>
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Pays</th>
              <th className="px-4 py-3">Portée</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visaTypes.map((vt) => (
              <tr key={vt.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{vt.name}</td>
                <td className="px-4 py-3 text-zinc-600">{vt.country || "—"}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {vt.program_title ? (
                    <>Spécifique : {vt.program_title}</>
                  ) : (
                    "Tous programmes"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{vt.price} MAD</td>
                <td className="px-4 py-3 text-end">
                  <Link
                    href={`/admin/visa-types/${vt.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
            {visaTypes.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={5}>
                  Aucun type de visa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
