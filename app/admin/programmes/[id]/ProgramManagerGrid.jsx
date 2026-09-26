"use client";

import { useState } from "react";
import Modal from "./Modal";
import ModuleTile from "./ModuleTile";
import InfoCard from "./InfoCard";
import AirportCard from "./AirportCard";
import HotelsCard from "./HotelsCard";
import TiersCard from "./TiersCard";
import ProgramFaqManager from "./ProgramFaqManager";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default function ProgramManagerGrid({
  programId,
  program,
  primaryTrip,
  airlines,
  hotels,
  defaultHotelIds,
  tripHotelsCount,
  roomsCount,
  tiers,
  faqs,
  canManagePrograms,
  canManageTrips,
  canManageInfo,
}) {
  const [openModule, setOpenModule] = useState(null);
  const close = () => setOpenModule(null);

  const tiles = [
    {
      key: "info",
      title: "Informations",
      subtitle: primaryTrip
        ? `${primaryTrip.reference_code} · ${primaryTrip.status} · ${program.is_published ? "Publié" : "Brouillon"}`
        : program.is_published
        ? "Publié"
        : "Brouillon",
    },
    {
      key: "airport",
      title: "Aéroport",
      subtitle:
        primaryTrip?.origin_iata && primaryTrip?.destination_iata
          ? `${primaryTrip.origin_iata} → ${primaryTrip.destination_iata}`
          : "À compléter",
    },
    {
      key: "hotels",
      title: "Hôtels",
      subtitle: `${plural(defaultHotelIds.length, "hôtel habituel")} · ${plural(tripHotelsCount, "attaché")}`,
    },
    ...(program.family === "omra_hajj"
      ? [
          {
            key: "tiers",
            title: "Tarifs d'hébergement",
            subtitle: plural(tiers.length, "tarif"),
          },
        ]
      : []),
    {
      key: "faq",
      title: "FAQ",
      subtitle: plural(faqs.length, "question"),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <ModuleTile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            onClick={() => setOpenModule(t.key)}
          />
        ))}
      </div>

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
            hotels={hotels}
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
