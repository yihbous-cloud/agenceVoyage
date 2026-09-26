"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import ModuleTile from "./ModuleTile";
import InfoCard from "./InfoCard";
import AirportCard from "./AirportCard";
import HotelsCard from "./HotelsCard";
import DisplayCard from "./DisplayCard";
import RestaurationCard from "./RestaurationCard";
import PricingCard from "./PricingCard";
import TiersCard from "./TiersCard";
import TripsList from "./TripsList";
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
  mealOffers,
  tiers,
  otherTrips,
  faqs,
  canManagePrograms,
  canManageTrips,
  canManageInfo,
}) {
  const [openModule, setOpenModule] = useState(null);
  const close = () => setOpenModule(null);

  const lowestPrice = primaryTrip
    ? Math.min(
        Number(primaryTrip.price_double),
        Number(primaryTrip.price_triple),
        Number(primaryTrip.price_quadruple),
        Number(primaryTrip.price_quintuple)
      )
    : null;

  const tiles = [
    {
      key: "info",
      title: "Informations",
      subtitle: primaryTrip
        ? `${primaryTrip.reference_code} · ${primaryTrip.status}`
        : "Aucun voyage",
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
    {
      key: "display",
      title: "Affichage",
      subtitle: program.is_published ? "Publié" : "Brouillon",
    },
    {
      key: "restauration",
      title: "Restauration",
      subtitle: plural(mealOffers.length, "offre"),
    },
    {
      key: "pricing",
      title: "Tarification",
      subtitle:
        lowestPrice != null
          ? `à partir de ${lowestPrice} ${primaryTrip.currency}`
          : "À compléter",
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
      key: "trips",
      title: "Voyages supplémentaires",
      subtitle: plural(otherTrips.length, "voyage"),
    },
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

      {openModule === "display" && (
        <Modal title="Affichage" onClose={close}>
          <DisplayCard program={program} canManage={canManagePrograms} onSuccess={close} />
        </Modal>
      )}

      {openModule === "restauration" && (
        <Modal title="Restauration" onClose={close}>
          <RestaurationCard
            tripId={primaryTrip?.id}
            initialOffers={mealOffers}
            canManage={canManageTrips}
          />
        </Modal>
      )}

      {openModule === "pricing" && (
        <Modal title="Tarification" onClose={close}>
          <PricingCard trip={primaryTrip} canManage={canManageTrips} onSuccess={close} />
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

      {openModule === "trips" && (
        <Modal title="Voyages supplémentaires" onClose={close}>
          <div className="space-y-3">
            {canManageTrips && (
              <Link
                href={`/admin/programmes/${programId}/voyages/new`}
                className="inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                + Nouveau voyage
              </Link>
            )}
            <TripsList trips={otherTrips} airlines={airlines} canManage={canManageTrips} />
          </div>
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
