"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/app/admin/_components/useConfirm";

function defaultPassenger(reg) {
  const [givenName, ...rest] = reg.full_name.trim().split(/\s+/);
  return {
    registrationId: reg.id,
    fullName: reg.full_name,
    title: reg.gender === "femme" ? "mrs" : "mr",
    givenName,
    familyName: rest.join(" ") || givenName,
    gender: reg.gender === "femme" ? "f" : "m",
    bornOn: reg.date_of_birth || "",
    email: reg.email || "",
    phoneNumber: reg.phone_whatsapp || "",
    passportNumber: reg.passport_number || "",
    passportExpiryDate: reg.passport_expiry_date || "",
  };
}

const STATUS_STYLES = {
  confirme: "bg-emerald-100 text-emerald-700",
  echec: "bg-red-100 text-red-700",
  en_attente: "bg-amber-100 text-amber-700",
  annule: "bg-zinc-200 text-zinc-600",
};

export default function FlightBookingManager({ tripId, bookable, bookings, canBook }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState(() => new Set(bookable.map((r) => r.id)));
  const [offers, setOffers] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [passengers, setPassengers] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const orderedSelected = bookable.filter((r) => selectedIds.has(r.id));

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    setOffers(null);
    setSelectedOfferId(null);
    setPassengers(null);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/flight-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationIds: orderedSelected.map((r) => r.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setOffers(data.offers);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const selectOffer = (offerId) => {
    setSelectedOfferId(offerId);
    setPassengers(orderedSelected.map(defaultPassenger));
  };

  const updatePassenger = (index, field, value) => {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleConfirmPurchase = async () => {
    if (
      !(await confirm(
        "Confirmer l'achat de ce(s) billet(s) ? Cette action déclenche une vraie commande auprès de Duffel."
      ))
    ) {
      return;
    }

    setBooking(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/flight-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          scope: orderedSelected.length > 1 ? "groupe" : "individuel",
          offerId: selectedOfferId,
          passengers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setResult(data);
      setOffers(null);
      setSelectedOfferId(null);
      setPassengers(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Billet(s) réservé(s) avec succès. Référence :{" "}
          {result.bookingReference || "en attente de la compagnie"}.
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Voyageurs sans billet ({bookable.length})
        </h2>

        <ul className="mt-3 divide-y divide-zinc-100">
          {bookable.map((reg) => (
            <li key={reg.id} className="flex items-center gap-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.has(reg.id)}
                disabled={!canBook}
                onChange={() => toggleSelected(reg.id)}
              />
              <span>
                {reg.full_name}{" "}
                <span className="text-zinc-400">
                  ({reg.gender}
                  {reg.passport_number ? `, passeport ${reg.passport_number}` : ""})
                </span>
              </span>
            </li>
          ))}
          {bookable.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">
              Tous les inscrits confirmés ont déjà un billet.
            </li>
          )}
        </ul>

        {canBook && bookable.length > 0 && (
          <button
            onClick={handleSearch}
            disabled={searching || selectedIds.size === 0}
            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {searching ? "Recherche..." : `Rechercher des vols (${selectedIds.size})`}
          </button>
        )}
      </section>

      {offers && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Offres disponibles ({offers.length})
          </h2>
          <div className="mt-3 space-y-3">
            {offers.map((offer) => (
              <label
                key={offer.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 text-sm ${
                  selectedOfferId === offer.id
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-zinc-200"
                }`}
              >
                <div>
                  <input
                    type="radio"
                    name="offer"
                    className="mr-3"
                    checked={selectedOfferId === offer.id}
                    onChange={() => selectOffer(offer.id)}
                  />
                  <span className="font-medium text-zinc-900">{offer.owner}</span>
                  {offer.slices.map((s, i) => (
                    <span key={i} className="ml-3 text-zinc-500">
                      {s.origin}→{s.destination} ({s.segmentsCount} segment
                      {s.segmentsCount > 1 ? "s" : ""})
                    </span>
                  ))}
                </div>
                <span className="font-semibold text-emerald-700">
                  {offer.totalAmount} {offer.totalCurrency}
                </span>
              </label>
            ))}
            {offers.length === 0 && (
              <p className="text-sm text-zinc-500">Aucune offre trouvée pour cette route/date.</p>
            )}
          </div>
        </section>
      )}

      {passengers && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Coordonnées des passagers
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Vérifiez que le nom correspond exactement au passeport avant de confirmer.
          </p>

          <div className="mt-4 space-y-6">
            {passengers.map((p, index) => (
              <div key={p.registrationId} className="rounded-lg border border-zinc-100 p-4">
                <p className="mb-2 text-sm font-semibold text-zinc-900">{p.fullName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500">Prénom</label>
                    <input
                      value={p.givenName}
                      onChange={(e) => updatePassenger(index, "givenName", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">Nom</label>
                    <input
                      value={p.familyName}
                      onChange={(e) => updatePassenger(index, "familyName", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">Date de naissance</label>
                    <input
                      type="date"
                      value={p.bornOn}
                      onChange={(e) => updatePassenger(index, "bornOn", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">Email</label>
                    <input
                      type="email"
                      value={p.email}
                      onChange={(e) => updatePassenger(index, "email", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">Téléphone</label>
                    <input
                      value={p.phoneNumber}
                      onChange={(e) => updatePassenger(index, "phoneNumber", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">N° Passeport</label>
                    <input
                      value={p.passportNumber}
                      onChange={(e) => updatePassenger(index, "passportNumber", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500">
                      Expiration passeport
                    </label>
                    <input
                      type="date"
                      value={p.passportExpiryDate}
                      onChange={(e) =>
                        updatePassenger(index, "passportExpiryDate", e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirmPurchase}
            disabled={booking}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {booking ? "Achat en cours..." : "Confirmer l'achat"}
          </button>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Billets réservés</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-2 py-2">Référence</th>
                <th className="px-2 py-2">Voyageurs</th>
                <th className="px-2 py-2">Montant</th>
                <th className="px-2 py-2">Statut</th>
                <th className="px-2 py-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-2 py-2">{b.booking_reference || "—"}</td>
                  <td className="px-2 py-2">{b.passenger_names || "—"}</td>
                  <td className="px-2 py-2">
                    {b.total_amount} {b.currency}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        STATUS_STYLES[b.status] || "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 uppercase text-zinc-500">{b.duffel_mode}</td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td className="px-2 py-2 text-zinc-500" colSpan={5}>
                    Aucun billet réservé pour ce voyage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}
