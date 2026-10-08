"use client";

import { useState } from "react";
import Modal from "@/app/admin/_components/Modal";
import ModuleTile from "@/app/admin/_components/ModuleTile";
import EditTravelerForm from "../../inscriptions/[id]/EditTravelerForm";
import EditRegistrationForm from "../../inscriptions/[id]/EditRegistrationForm";
import VisaStatusForm from "../../inscriptions/[id]/VisaStatusForm";
import PaymentsSection from "../../inscriptions/[id]/PaymentsSection";
import { formatMoney } from "@/app/admin/_components/statusStyles";
import AddGroupMemberForm from "./AddGroupMemberForm";
import GroupResponsibleForm from "./GroupResponsibleForm";

// Grille de tuiles + modale (§3soixantehuitquadragies, demande explicite) :
// "Informations Voyageurs" et "Visa" restent PAR VOYAGEUR (une tuile par
// membre chacune) ; "Hébergement et Paiement" est en revanche une tuile
// UNIQUE pour tout le groupe — le montant dû/l'historique des versements
// sont réellement partagés (§3quindecies), et les champs d'hébergement de
// chaque membre (tarif/type/groupe) y sont simplement listés l'un après
// l'autre plutôt que répétés dans N tuiles séparées.
export default function GroupManagerGrid({
  group,
  members,
  role,
  canDelete,
  tripGroups,
  tiers,
  initialMode,
  canEditVoyageur,
  canEditVisa,
  canManagePayments,
  payments,
  apiBasePath,
  canAdminDiscount = false,
  discountCap = null,
}) {
  const [openModule, setOpenModule] = useState(null);
  const close = () => setOpenModule(null);

  const openVoyageurData = members.find((m) => `voyageur-${m.id}` === openModule);
  const openVisaData = members.find((m) => `visa-${m.id}` === openModule);

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Membres du groupe ({members.length})
        </h2>
        {members.length > 0 && (
          <GroupResponsibleForm
            groupId={group.id}
            members={members}
            responsibleRegistrationId={group.responsible_registration_id}
            role={role}
          />
        )}

        {members.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">Aucun membre.</p>
        )}

        <div className="mt-4 space-y-4">
          {members.map((member) => (
            <div key={member.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-sm font-semibold text-zinc-900">
                {member.full_name}{" "}
                <span className="font-normal capitalize text-zinc-500">
                  ({member.gender})
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ModuleTile
                  title="Informations Voyageurs"
                  icon="person"
                  subtitle={
                    member.passport_number
                      ? `Passeport ${member.passport_number}`
                      : "Passeport non renseigné"
                  }
                  onClick={() => setOpenModule(`voyageur-${member.id}`)}
                />
                <ModuleTile
                  title="Visa"
                  icon="badge"
                  subtitle={`Statut : ${member.visa_status}`}
                  onClick={() => setOpenModule(`visa-${member.id}`)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <ModuleTile
            title="Hébergement et Paiement"
            icon="bed"
            subtitle={`${group.total_due} MAD dû`}
            onClick={() => setOpenModule("hebergement_paiement")}
          />
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <AddGroupMemberForm
            tripId={group.trip_id}
            groupId={group.id}
            departureDate={group.departure_date}
          />
        </div>
      </div>

      {openVoyageurData && (
        <Modal title={`Informations Voyageurs — ${openVoyageurData.full_name}`} onClose={close}>
          <EditTravelerForm
            registration={openVoyageurData}
            canEdit={canEditVoyageur}
            initialMode={initialMode}
            initialPhoneNumbers={openVoyageurData.phoneNumbers}
          />
        </Modal>
      )}

      {openVisaData && (
        <Modal title="Visa" onClose={close}>
          <p className="mb-3 text-sm text-zinc-500">{openVisaData.full_name}</p>
          <VisaStatusForm
            apiBasePath={`/api/admin/registrations/${openVisaData.id}`}
            visaStatus={openVisaData.visa_status}
            passportNumber={openVisaData.passport_number}
            passportExpiryDate={openVisaData.passport_expiry_date}
            canManage={canEditVisa}
          />
        </Modal>
      )}

      {openModule === "hebergement_paiement" && (
        <Modal title="Hébergement et Paiement" onClose={close}>
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-zinc-200 p-3">
                <p className="mb-2 text-sm font-semibold text-zinc-900">{member.full_name}</p>
                <EditRegistrationForm
                  registration={member}
                  role={role}
                  canDelete={canDelete}
                  tripGroups={tripGroups}
                  tiers={tiers}
                  initialMode={initialMode}
                  stayOnPage
                  canAdminDiscount={canAdminDiscount}
                  discountCap={discountCap}
                />
              </div>
            ))}

            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <p className="text-sm text-zinc-500">
                Montant dû et versements partagés par tout le groupe — pas un montant par
                personne.
              </p>
              {/* Montant dû du groupe = somme des nets (formule − réduction) de
                  chaque membre actif, recalculé automatiquement. */}
              <p className="text-sm">
                <span className="text-zinc-500">Montant dû du groupe : </span>
                <span className="font-semibold">{formatMoney(group.total_due)} MAD</span>
                <span className="text-xs text-zinc-500"> — somme des montants nets de chaque membre</span>
              </p>
              <PaymentsSection
                apiBasePath={apiBasePath}
                payments={payments}
                totalDue={group.total_due}
                canManage={canManagePayments}
                title="Paiements du groupe"
                bare
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
