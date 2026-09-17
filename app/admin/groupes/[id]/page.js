import { notFound } from "next/navigation";
import Link from "next/link";
import { getGroupById, getGroupMembers } from "@/lib/registrationGroups";
import { listPaymentsForGroup } from "@/lib/payments";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import GroupDueForm from "./GroupDueForm";
import PaymentsSection from "../../inscriptions/[id]/PaymentsSection";

const STATUS_LABELS = {
  inscrit: "Inscrit",
  confirme: "Confirmé",
  paye_partiel: "Payé partiel",
  paye_complet: "Payé complet",
  annule: "Annulé",
};

const VISA_LABELS = {
  non_demande: "Non demandé",
  en_cours: "En cours",
  accorde: "Accordé",
  refuse: "Refusé",
};

export default async function GroupDetailPage({ params }) {
  const { id } = await params;
  const [group, members, session] = await Promise.all([
    getGroupById(id),
    getGroupMembers(id),
    getSession(),
  ]);

  if (!group) {
    notFound();
  }

  const [payments, canManagePayments] = await Promise.all([
    listPaymentsForGroup(id),
    hasPermission(session, "paiements.manage"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          {group.label}
          {group.allow_mixed_gender_room && (
            <span className="ml-2 text-sm font-normal text-emerald-700">
              (couple/famille)
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">
          {group.program_title} — {group.reference_code} (
          {new Date(group.departure_date).toLocaleDateString("fr-FR")})
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Membres du groupe ({members.length})
        </h2>
        <ul className="mt-3 divide-y divide-zinc-100">
          {members.map((m) => (
            <li key={m.registration_id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <Link
                  href={`/admin/inscriptions/${m.registration_id}`}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  {m.full_name}
                </Link>{" "}
                <span className="capitalize text-zinc-500">({m.gender})</span>
              </span>
              <span className="text-zinc-500">
                {STATUS_LABELS[m.status] || m.status} · {VISA_LABELS[m.visa_status] || m.visa_status}
              </span>
            </li>
          ))}
          {members.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">Aucun membre.</li>
          )}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          Le détail individuel (passeport, visa, statut, hébergement) se gère depuis
          la fiche de chaque voyageur, en cliquant sur son nom.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Montant dû</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Partagé par tout le groupe — pas un montant par personne.
        </p>
        <div className="mt-3">
          <GroupDueForm groupId={group.id} totalDue={group.total_due} canManage={canManagePayments} />
        </div>
      </div>

      <PaymentsSection
        apiBasePath={`/api/admin/groups/${group.id}`}
        payments={payments}
        totalDue={group.total_due}
        canManage={canManagePayments}
        title="Paiements du groupe"
      />
    </div>
  );
}
