"use client";

import { useState } from "react";
import Modal from "@/app/admin/_components/Modal";
import ModuleTile from "@/app/admin/_components/ModuleTile";
import InfoCard from "./InfoCard";
import AirportCard from "./AirportCard";
import HotelsCard from "./HotelsCard";
import TiersCard from "./TiersCard";
import ProgramFaqManager from "./ProgramFaqManager";
import ExpensesCard from "./ExpensesCard";
import { summarizeExpenses } from "@/lib/expenseState";
import { formatMoney } from "@/app/admin/_components/statusStyles";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

export default function ProgramManagerGrid({
  programId,
  program,
  primaryTrip,
  airlines,
  hotels,
  defaultHotelIds,
  tripHotelsCount,
  tripHotelIds = [],
  roomsCount,
  tiers,
  faqs,
  canManagePrograms,
  canManageTrips,
  canManageInfo,
  showCharges = false,
  canManageCharges = false,
  expenses = [],
}) {
  const { tr } = useAdminLocale();
  const plural = (n, one, other) => tr.plural(`{count} ${one}`, `{count} ${other}`, n);
  const [openModule, setOpenModule] = useState(null);
  const close = () => setOpenModule(null);

  // Les tarifs d'hébergement ne doivent proposer que les hôtels déjà
  // retenus comme "habituels" pour ce programme (carte Hôtels) — pas le
  // catalogue global complet (`hotels`, utilisé par HotelsCard pour choisir
  // justement CES hôtels habituels). Demande explicite : les deux fenêtres
  // doivent rester cohérentes (CLAUDE.md).
  const habitualHotels = hotels.filter((h) => defaultHotelIds.includes(h.id));

  const tiles = [
    {
      key: "info",
      icon: "info",
      title: "Informations",
      subtitle: primaryTrip
        ? `${primaryTrip.reference_code} · ${primaryTrip.status} · ${program.is_published ? "Publié" : "Brouillon"}`
        : program.is_published
        ? "Publié"
        : "Brouillon",
    },
    {
      key: "airport",
      icon: "flight",
      title: "Aéroport",
      subtitle:
        primaryTrip?.origin_iata && primaryTrip?.destination_iata
          ? `${primaryTrip.origin_iata} → ${primaryTrip.destination_iata}`
          : "À compléter",
    },
    {
      key: "hotels",
      icon: "hotel",
      title: "Hôtels",
      subtitle: `${plural(defaultHotelIds.length, "hôtel habituel", "hôtels habituels")} · ${plural(tripHotelsCount, "attaché", "attachés")}`,
    },
    ...(program.family === "omra_hajj"
      ? [
          {
            key: "tiers",
            icon: "payments",
            title: "Tarifs d'hébergement",
            subtitle: plural(tiers.length, "tarif", "tarifs"),
          },
        ]
      : []),
    ...(showCharges
      ? [
          (() => {
            const s = summarizeExpenses(expenses);
            return {
              key: "charges",
              icon: "account_balance_wallet",
              title: "Charges financières",
              subtitle:
                expenses.length > 0
                  ? `${formatMoney(s.total)} ${tr("MAD")} · ${plural(expenses.length, "charge", "charges")}`
                  : "Aucune charge",
              meta:
                s.overdue > 0
                  ? tr("En retard : {amount}", { amount: `${formatMoney(s.overdue)} ${tr("MAD")}` })
                  : expenses.length > 0
                  ? tr("Reste à payer : {amount}", { amount: `${formatMoney(s.remaining)} ${tr("MAD")}` })
                  : null,
            };
          })(),
        ]
      : []),
    {
      key: "faq",
      icon: "help",
      title: "FAQ",
      subtitle: plural(faqs.length, "question", "questions"),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <ModuleTile
            key={t.key}
            title={t.title}
            icon={t.icon}
            subtitle={t.subtitle}
            meta={t.meta}
            onClick={() => setOpenModule(t.key)}
          />
        ))}
      </div>

      {openModule === "charges" && (
        <Modal title="Charges financières" onClose={close} size="lg">
          <ExpensesCard
            tripId={primaryTrip?.id}
            expenses={expenses}
            // Seuls les hôtels et la compagnie déjà affectés au programme :
            // hôtels habituels + hôtels attachés au voyage, compagnie du voyage.
            hotels={hotels.filter((h) => defaultHotelIds.includes(h.id) || tripHotelIds.includes(h.id))}
            airlines={airlines.filter((a) => a.id === primaryTrip?.airline_id)}
            allHotels={hotels}
            allAirlines={airlines}
            canManage={canManageCharges}
          />
        </Modal>
      )}

      {openModule === "info" && (
        <Modal title="Informations" onClose={close}>
          <InfoCard
            program={program}
            trip={primaryTrip}
            canManage={canManageInfo}
            onSuccess={close}
          />
        </Modal>
      )}

      {openModule === "airport" && (
        <Modal title="Aéroport" onClose={close}>
          <AirportCard
            trip={primaryTrip}
            airlines={airlines}
            canManage={canManageTrips}
            onSuccess={close}
          />
        </Modal>
      )}

      {openModule === "hotels" && (
        <Modal title="Hôtels" onClose={close}>
          <HotelsCard
            program={program}
            hotels={hotels}
            defaultHotelIds={defaultHotelIds}
            tripHotelsCount={tripHotelsCount}
            roomsCount={roomsCount}
            primaryTripId={primaryTrip?.id}
            canManage={canManagePrograms}
            onSuccess={close}
          />
        </Modal>
      )}

      {openModule === "tiers" && (
        <Modal title="Tarifs d'hébergement" onClose={close}>
          <TiersCard
            trip={primaryTrip}
            hotels={habitualHotels}
            initialTiers={tiers}
            canManage={canManageTrips}
          />
        </Modal>
      )}

      {openModule === "faq" && (
        <Modal title="FAQ (affichée sur la fiche publique du programme)" onClose={close}>
          <ProgramFaqManager
            programId={programId}
            initialFaqs={faqs}
            canManage={canManagePrograms}
          />
        </Modal>
      )}
    </>
  );
}
