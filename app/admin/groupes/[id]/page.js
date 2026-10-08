import { notFound } from "next/navigation";
import { getGroupById, getGroupMembers, listGroupsForTrip } from "@/lib/registrationGroups";
import { listPaymentsForGroup } from "@/lib/payments";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTiersForTrip } from "@/lib/tripHotelTiers";
import { listPhoneNumbersForTraveler } from "@/lib/travelerPhoneNumbers";
import GroupManagerGrid from "./GroupManagerGrid";

// §3cinquantehuitquadragies : le traitement d'un membre de groupe (statut,
// visa, préférence d'hébergement/tarif, notes, montant dû) se fait
// désormais ICI — une fois par membre, en réutilisant EditRegistrationForm
// tel quel (§3cinquantehuitquadragies) — plutôt que sur la fiche
// individuelle de chaque membre (qui ne garde que l'identité/passeport,
// voir app/admin/inscriptions/[id]/page.js).
export default async function GroupDetailPage({ params, searchParams }) {
  const { id } = await params;
  const search = await searchParams;
  const mode = search?.mode === "edit" ? "edit" : "view";

  const [group, members, session] = await Promise.all([
    getGroupById(id),
    getGroupMembers(id),
    getSession(),
  ]);

  if (!group) {
    notFound();
  }

  const [payments, canManagePayments, canDeleteRegistration, tripGroups, tiers, canEditVoyageur] =
    await Promise.all([
      listPaymentsForGroup(id),
      hasPermission(session, "paiements.manage"),
      hasPermission(session, "inscriptions.delete"),
      listGroupsForTrip(group.trip_id),
      group.program_family === "omra_hajj" ? listTiersForTrip(group.trip_id) : [],
      hasPermission(session, "inscriptions.edit_voyageur"),
    ]);

  // canEditVisa : même restriction fine par rôle que sur la fiche
  // individuelle (app/admin/inscriptions/[id]/page.js) — voir CLAUDE.md
  // §3undecies. Le statut visa reste individuel par voyageur même au sein
  // d'un groupe (§3trevicies), donc un VisaStatusForm par membre ici.
  const canEditVisa = ["direction", "suivi"].includes(session?.role);

  // Carte "Informations Voyageurs" par membre (§3soixantehuitquadragies) :
  // departure_date (validation passeport) vient du groupe — tous les
  // membres partagent le même voyage — et les numéros supplémentaires sont
  // chargés par membre, comme sur la fiche individuelle.
  const membersWithTravelerData = await Promise.all(
    members.map(async (member) => ({
      ...member,
      departure_date: group.departure_date,
      phoneNumbers: await listPhoneNumbersForTraveler(member.traveler_id),
    }))
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          {group.label}
          {Boolean(group.allow_mixed_gender_room) && (
            <span className="ms-2 text-sm font-normal text-emerald-700">
              (couple/famille)
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">
          {group.program_title} — {group.reference_code} (
          {new Date(group.departure_date).toLocaleDateString("fr-FR")})
        </p>
      </div>

      <GroupManagerGrid
        group={group}
        members={membersWithTravelerData}
        role={session?.role}
        canDelete={canDeleteRegistration}
        tripGroups={tripGroups}
        tiers={tiers}
        initialMode={mode}
        canEditVoyageur={canEditVoyageur}
        canEditVisa={canEditVisa}
        canManagePayments={canManagePayments}
        payments={payments}
        apiBasePath={`/api/admin/groups/${group.id}`}
      />
    </div>
  );
}
