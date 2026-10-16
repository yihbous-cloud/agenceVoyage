"use client";

import { organizerLabel } from "@/lib/organizers";
import { useState } from "react";
import Modal from "@/app/admin/_components/Modal";
import ModuleTile from "@/app/admin/_components/ModuleTile";
import InfoCard from "./InfoCard";
import AirportCard from "./AirportCard";
import HotelsCard from "./HotelsCard";
import TiersCard from "./TiersCard";
import ProgramFaqManager from "./ProgramFaqManager";
import ExpensesCard from "./ExpensesCard";
import PackagesCard from "./PackagesCard";
import FicheContentCard from "./FicheContentCard";
import MediaCard from "./MediaCard";
import ReviewsCard from "./ReviewsCard";
import CompletenessPanel from "./CompletenessPanel";
import { summarizeExpenses } from "@/lib/expenseState";
import { formatMoney } from "@/app/admin/_components/statusStyles";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

export default function ProgramManagerGrid({
  programId,
  program,
  successorOptions = [],
  primaryTrip,
  airlines,
  hotels,
  defaultHotelIds,
  tripHotelsCount,
  tripHotelIds = [],
  roomsCount,
  tiers,
  faqs,
  programTranslations = {},
  faqTranslations = {},
  canManagePrograms,
  canManageTrips,
  canManageInfo,
  showCharges = false,
  canManageCharges = false,
  expenses = [],
  canAdminDiscount = false,
  discountCap = null,
  media = [],
  reviews = [],
  trips = [],
  completeness = null,
}) {
  const { tr, locale } = useAdminLocale();
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
      subtitle: [
        primaryTrip ? `${primaryTrip.reference_code} · ${primaryTrip.status}` : null,
        tr(program.is_published ? "Publié" : "Brouillon"),
        program.organizer ? organizerLabel(program.organizer, locale) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      // Plafond de réduction (administrateur seulement) : fait partie des
      // informations du programme, pas de la formule billet.
      meta:
        canAdminDiscount && primaryTrip
          ? discountCap === null
            ? "Plafond de réduction non défini"
            : tr("Plafond : {amount}", { amount: `${formatMoney(discountCap)} ${tr("MAD")}` })
          : null,
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
    ...(primaryTrip
      ? [
          {
            key: "packages",
            icon: "redeem",
            title: "Formules partielles",
            subtitle:
              Number(primaryTrip.price_flight_only) > 0
                ? tr("Billet seul : {amount}", { amount: `${formatMoney(primaryTrip.price_flight_only)} ${tr("MAD")}` })
                : "Prix billet seul à renseigner",
          },
        ]
      : []),
    {
      key: "fiche",
      icon: "description",
      title: "Contenu de la fiche",
      subtitle: completeness
        ? tr("Fiche : {score}/{total} blocs", { score: completeness.score, total: completeness.total })
        : "",
    },
    {
      key: "media",
      icon: "view_carousel",
      title: "Photos & vidéo",
      subtitle: plural(media.filter((m) => m.kind === "photo").length, "photo", "photos"),
      meta: media.some((m) => m.kind === "video") ? "Vidéo ajoutée" : null,
    },
    {
      key: "reviews",
      icon: "thumb_up",
      title: "Avis clients",
      subtitle: plural(reviews.length, "avis", "avis"),
      meta: (() => {
        const published = reviews.filter((r) => r.is_published && r.consent_given).length;
        return published > 0 ? plural(published, "publié", "publiés") : null;
      })(),
    },
    {
      key: "faq",
      icon: "help",
      title: "FAQ",
      subtitle: plural(faqs.length, "question", "questions"),
    },
  ];

  return (
    <>
      {completeness && <CompletenessPanel completeness={completeness} />}
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

      {openModule === "packages" && (
        <Modal title="Formules partielles" onClose={close}>
          <PackagesCard
            tripId={primaryTrip?.id}
            priceFlightOnly={primaryTrip?.price_flight_only}
            canManage={canManageTrips}
            onSuccess={close}
          />
        </Modal>
      )}

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
            translations={programTranslations}
            successorOptions={successorOptions}
            trip={primaryTrip}
            hasTierPrices={tiers.some((t) => (t.prices || []).some((p) => Number(p.price_per_person) > 0))}
            canManage={canManageInfo}
            canAdminDiscount={canAdminDiscount}
            discountCap={discountCap}
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

      {openModule === "fiche" && (
        <Modal title="Contenu de la fiche" onClose={close} size="lg">
          <FicheContentCard
            program={program}
            translations={programTranslations}
            canManage={canManagePrograms}
            onSuccess={close}
          />
        </Modal>
      )}

      {openModule === "media" && (
        <Modal title="Photos & vidéo" onClose={close} size="lg">
          <MediaCard programId={programId} initialMedia={media} canManage={canManagePrograms} />
        </Modal>
      )}

      {openModule === "reviews" && (
        <Modal title="Avis clients" onClose={close} size="lg">
          <ReviewsCard programId={programId} initialReviews={reviews} trips={trips} canManage={canManagePrograms} />
        </Modal>
      )}

      {openModule === "faq" && (
        <Modal title="FAQ (affichée sur la fiche publique du programme)" onClose={close}>
          <ProgramFaqManager
            programId={programId}
            initialFaqs={faqs}
            contentLocale={program.content_locale || "ar"}
            faqTranslations={faqTranslations}
            canManage={canManagePrograms}
          />
        </Modal>
      )}
    </>
  );
}
