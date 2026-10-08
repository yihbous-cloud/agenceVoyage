"use client";

import { useState } from "react";
import Modal from "@/app/admin/_components/Modal";
import ModuleTile from "@/app/admin/_components/ModuleTile";
import EditTravelerForm from "./EditTravelerForm";
import EditRegistrationForm from "./EditRegistrationForm";
import VisaStatusForm from "./VisaStatusForm";
import StatusNotesForm from "./StatusNotesForm";
import PaymentsSection from "./PaymentsSection";
import { REGISTRATION_STATUS, VISA_STATUS, formatMoney } from "@/app/admin/_components/statusStyles";

// Grille de tuiles + modale, même pattern que ProgramManagerGrid.jsx
// (/admin/programmes/[id]) — demande explicite de l'utilisateur d'aligner
// l'écran de fiche inscription sur ce même modèle visuel (voir CLAUDE.md).
export default function InscriptionManagerGrid({
  registration,
  role,
  canDelete,
  tripGroups,
  tiers,
  initialMode,
  initialPhoneNumbers,
  payments,
  apiBasePath,
  canEditVoyageur,
  canManagePayments,
  canEditFinance,
  canEditVisa,
  canAdminDiscount = false,
  discountCap = null,
}) {
  const [openModule, setOpenModule] = useState(null);
  const close = () => setOpenModule(null);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);
  const status = REGISTRATION_STATUS[registration.status];
  const visa = VISA_STATUS[registration.visa_status];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const expiry = fmtDate(registration.passport_expiry_date);

  const tiles = [
    {
      key: "voyageur",
      icon: "person",
      title: "Informations Voyageurs",
      subtitle: registration.passport_number ? (
        <>
          Passeport <span className="gf-mono" translate="no">{registration.passport_number}</span>
        </>
      ) : (
        "Passeport non renseigné"
      ),
      meta: expiry ? `Expire le ${expiry}` : registration.phone_whatsapp,
    },
  ];

  if (registration.group_id) {
    tiles.push({
      key: "groupe",
      icon: "groups",
      title: "Groupe",
      subtitle: <span translate="no">{registration.group_label}</span>,
      meta: "Suivi et paiement gérés depuis la fiche du groupe",
      href: `/admin/groupes/${registration.group_id}`,
    });
  } else {
    // Hébergement (tarif/type/groupe) et Paiement regroupés dans une seule
    // carte (§3soixantetroisquadragies, demande explicite) — le Statut
    // vient s'y ajouter en bas, toujours modifiable et auto-actualisé
    // depuis les paiements (StatusNotesForm.jsx), pas verrouillé comme le
    // reste de la carte.
    tiles.push({
      key: "hebergement_paiement",
      icon: "bed",
      title: "Hébergement et Paiement",
      badge: status ? { label: status.label, bg: status.bg, fg: status.fg } : null,
      subtitle: `${formatMoney(totalPaid)} / ${formatMoney(registration.total_due)} MAD payés`,
      meta: registration.preferred_room_type ? `Chambre ${registration.preferred_room_type}` : null,
    });
  }

  tiles.push({
    key: "visa",
    icon: "badge",
    title: "Visa",
    badge: visa ? { label: visa.label, bg: visa.bg, fg: visa.fg } : null,
    subtitle: visa ? `Statut : ${visa.label}` : registration.visa_status,
    meta: expiry ? `Validité du passeport : ${expiry}` : null,
  });

  return (
    <>
      <div className="gf-tiles">
        {tiles.map((t) => (
          <ModuleTile
            key={t.key}
            title={t.title}
            icon={t.icon}
            subtitle={t.subtitle}
            meta={t.meta}
            badge={t.badge}
            href={t.href}
            onClick={t.href ? undefined : () => setOpenModule(t.key)}
          />
        ))}
      </div>

      {openModule === "voyageur" && (
        <Modal title="Informations Voyageurs" onClose={close}>
          <EditTravelerForm
            registration={registration}
            canEdit={canEditVoyageur}
            initialMode={initialMode}
            initialPhoneNumbers={initialPhoneNumbers}
            onSuccess={close}
          />
        </Modal>
      )}

      {openModule === "hebergement_paiement" && (
        <Modal title="Hébergement et Paiement" onClose={close}>
          <div className="space-y-4">
            <EditRegistrationForm
              registration={registration}
              role={role}
              canDelete={canDelete}
              tripGroups={tripGroups}
              tiers={tiers}
              initialMode={initialMode}
              showStatusAndNotes={false}
              canAdminDiscount={canAdminDiscount}
              discountCap={discountCap}
            />

            <div className="space-y-4 border-t border-zinc-200 pt-4">
              {/* Montant dû = formule − réduction (carte ci-dessus), plus saisi à la main. */}
              <PaymentsSection
                apiBasePath={apiBasePath}
                payments={payments}
                totalDue={registration.total_due}
                canManage={canManagePayments}
                bare
              />
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <StatusNotesForm
                apiBasePath={apiBasePath}
                status={registration.status}
                notes={registration.notes}
                role={role}
              />
            </div>
          </div>
        </Modal>
      )}

      {openModule === "visa" && (
        <Modal title="Visa" onClose={close}>
          <p className="mb-3 text-sm text-zinc-500">{registration.full_name}</p>
          <VisaStatusForm
            apiBasePath={apiBasePath}
            visaStatus={registration.visa_status}
            passportNumber={registration.passport_number}
            passportExpiryDate={registration.passport_expiry_date}
            canManage={canEditVisa}
          />
        </Modal>
      )}
    </>
  );
}
