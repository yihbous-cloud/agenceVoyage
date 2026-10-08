import Link from "next/link";
import { listVisaServiceRequests } from "@/lib/visaServices";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import PageHeader from "../_components/PageHeader";
import Icon from "../_components/Icon";

const STATUS_LABELS = {
  non_demande: "Non demandé",
  en_cours: "En cours",
  accorde: "Accordé",
  refuse: "Refusé",
};

function money(n) {
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

export default async function VisaServicesPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status || undefined;

  const session = await getSession();
  const [requests, canManage] = await Promise.all([
    listVisaServiceRequests({ status }),
    hasPermission(session, "visa_services.manage"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="assignment"
        title="Service visa (hors voyage)"
        description={<>
        Clients qui demandent uniquement une aide visa, indépendamment de tout
        voyage réservé chez l&apos;agence — suivi financier propre à chaque demande.
      </>}
      >
        {canManage && (
          <Link href="/admin/visa-services/new" className="gf-btn-primary">
            <Icon name="add" size={19} />
            Nouvelle demande
          </Link>
        )}
      </PageHeader>

      {status && (
        <p className="text-sm text-zinc-500">
          Filtré par statut :{" "}
          <span className="font-medium text-zinc-700">
            {STATUS_LABELS[status] || status}
          </span>
          {" — "}
          <Link href="/admin/visa-services" className="text-emerald-700 hover:underline">
            réinitialiser
          </Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Type de visa</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Dû</th>
              <th className="px-4 py-3">Payé</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">{r.full_name}</td>
                <td className="px-4 py-3">{r.phone_whatsapp}</td>
                <td className="px-4 py-3">
                  {r.visa_type_name}
                  {r.country && <span className="text-zinc-400"> ({r.country})</span>}
                </td>
                <td className="px-4 py-3">{STATUS_LABELS[r.status] || r.status}</td>
                <td className="px-4 py-3">{money(r.total_due)} MAD</td>
                <td className="px-4 py-3 text-emerald-700">{money(r.total_paid)} MAD</td>
                <td className="px-4 py-3 text-end">
                  <Link
                    href={`/admin/visa-services/${r.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    Afficher
                  </Link>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                  Aucune demande de service visa pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
