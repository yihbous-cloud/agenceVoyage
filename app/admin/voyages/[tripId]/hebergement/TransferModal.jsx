"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/app/admin/_components/Modal";

// Transfert d'un voyageur (ou de son groupe) : changer de chambre dans la
// même ville (même hôtel ou autre hôtel) et/ou quitter totalement ce voyage
// pour un autre voyage/programme. Le serveur reste la source de vérité de
// toutes les règles (capacité, mixité, passeport, places) — voir
// lib/roomAssignment.js et lib/tripTransfer.js.
export default function TransferModal({
  traveler,
  currentRoom,
  rooms,
  occupantsByRoom,
  otherTrips,
  onClose,
}) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [targetRoomId, setTargetRoomId] = useState("");
  const [withGroup, setWithGroup] = useState(true);
  const [targetTripId, setTargetTripId] = useState("");
  const [confirmTrip, setConfirmTrip] = useState(false);

  const inGroup = Boolean(traveler.group_id);

  const groupMembersInRoom = currentRoom
    ? (occupantsByRoom.get(currentRoom.id) || []).filter(
        (o) => inGroup && o.group_id === traveler.group_id
      )
    : [];
  const canMoveGroup = groupMembersInRoom.length > 1;
  const movingIds =
    canMoveGroup && withGroup ? groupMembersInRoom.map((m) => m.id) : [traveler.id];

  const isCompatible = (room) => {
    if (room.capacity - room.occupants_count < movingIds.length) return false;
    if (!room.occupants_gender) return true;
    const otherGender = room.occupants_gender.split(" + ").some((g) => g !== traveler.gender);
    return !otherGender || Boolean(inGroup && traveler.allow_mixed_gender_room);
  };

  const candidateRooms = currentRoom
    ? rooms.filter(
        (r) => r.id !== currentRoom.id && r.hotel_city === currentRoom.hotel_city && isCompatible(r)
      )
    : [];

  const roomsByHotel = [];
  for (const r of candidateRooms) {
    let group = roomsByHotel.find((g) => g.hotel_id === r.hotel_id);
    if (!group) {
      group = { hotel_id: r.hotel_id, hotel_name: r.hotel_name, items: [] };
      roomsByHotel.push(group);
    }
    group.items.push(r);
  }

  const call = async (url, body) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du transfert");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleRoomTransfer = () =>
    call(`/api/admin/registrations/${traveler.id}/room`, {
      roomId: targetRoomId,
      registrationIds: movingIds,
    });

  const handleTripTransfer = () =>
    call(`/api/admin/registrations/${traveler.id}/transfer-trip`, { targetTripId });

  return (
    <Modal title={`Transférer — ${traveler.full_name}`} onClose={onClose}>
      <div className="space-y-6">
        {currentRoom && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900">Changer de chambre</h3>
            <p className="text-xs text-zinc-500">
              Actuellement : {currentRoom.hotel_name} — chambre {currentRoom.room_number || "—"} (
              {currentRoom.hotel_city}). Même hôtel ou autre hôtel de la même ville.
            </p>
            {canMoveGroup && (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={withGroup}
                  onChange={(e) => {
                    setWithGroup(e.target.checked);
                    setTargetRoomId("");
                  }}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Déplacer aussi les {groupMembersInRoom.length - 1} autre(s) membre(s) du groupe «{" "}
                {traveler.group_label} » présents dans cette chambre
              </label>
            )}
            <select
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">
                {candidateRooms.length === 0 ? "Aucune autre chambre compatible" : "Choisir la chambre..."}
              </option>
              {roomsByHotel.map((g) => (
                <optgroup key={g.hotel_id} label={g.hotel_name}>
                  {g.items.map((r) => (
                    <option key={r.id} value={r.id}>
                      Chambre {r.room_number || "—"} · {r.room_type} ({r.capacity - r.occupants_count}{" "}
                      place(s) libre(s))
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              disabled={!targetRoomId || busy}
              onClick={handleRoomTransfer}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Transférer vers cette chambre
            </button>
          </section>
        )}

        <section className="space-y-2 border-t border-zinc-100 pt-4">
          <h3 className="text-sm font-semibold text-zinc-900">Transférer vers un autre voyage</h3>
          <p className="text-xs text-zinc-500">
            Le voyageur quitte ce voyage : ses affectations de chambre, ses préférences d&apos;hôtel et
            son tarif d&apos;hébergement sont remis à zéro (à rechoisir sur le nouveau voyage). Le
            montant dû et les versements sont conservés.
            {inGroup && ` Le groupe « ${traveler.group_label} » est transféré en entier.`}
          </p>
          <select
            value={targetTripId}
            onChange={(e) => {
              setTargetTripId(e.target.value);
              setConfirmTrip(false);
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">
              {otherTrips.length === 0 ? "Aucun autre voyage ouvert" : "Choisir le voyage..."}
            </option>
            {otherTrips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.reference_code} (départ{" "}
                {new Date(t.departure_date).toLocaleDateString("fr-FR")})
              </option>
            ))}
          </select>
          {!confirmTrip ? (
            <button
              type="button"
              disabled={!targetTripId || busy}
              onClick={() => setConfirmTrip(true)}
              className="rounded-lg border border-amber-600 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Transférer vers ce voyage
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <span>
                Confirmer le transfert de {inGroup ? `tout le groupe « ${traveler.group_label} »` : traveler.full_name} ?
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleTripTransfer}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmTrip(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-white"
              >
                Annuler
              </button>
            </div>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
