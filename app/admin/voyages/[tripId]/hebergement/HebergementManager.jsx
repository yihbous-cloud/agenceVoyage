"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_TYPE_CAPACITY, ROOM_TYPES } from "@/lib/roomTypes";

export default function HebergementManager({
  tripId,
  tripDepartureDate,
  tripReturnDate,
  hotels,
  tripHotels,
  rooms,
  unassigned,
  canManage,
}) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [autoAssignResult, setAutoAssignResult] = useState(null);

  // --- Ajout d'un hôtel au voyage ---
  const [hotelId, setHotelId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const handleAddHotel = async (e) => {
    e.preventDefault();
    setError(null);

    // Les dates de séjour à l'hôtel ne doivent pas sortir des dates du
    // voyage — vérifié aussi côté serveur (source de vérité), voir
    // CLAUDE.md.
    if (checkIn < tripDepartureDate || checkOut > tripReturnDate) {
      setError(
        `Les dates de l'hôtel doivent rester entre le ${new Date(
          tripDepartureDate
        ).toLocaleDateString("fr-FR")} et le ${new Date(tripReturnDate).toLocaleDateString(
          "fr-FR"
        )} (dates du voyage).`
      );
      return;
    }
    if (checkIn >= checkOut) {
      setError("La date de check-out doit être après la date de check-in.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/hotels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId, checkInDate: checkIn, checkOutDate: checkOut }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      setHotelId("");
      setCheckIn("");
      setCheckOut("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveTripHotel = async (id) => {
    if (!confirm("Retirer cet hôtel du voyage ? Les chambres associées seront supprimées.")) return;
    await fetch(`/api/admin/trip-hotels/${id}`, { method: "DELETE" });
    router.refresh();
  };

  // --- Création de chambre ---
  const [roomTripHotelId, setRoomTripHotelId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("double");
  const capacity = ROOM_TYPE_CAPACITY[roomType];

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/admin/trip-hotels/${roomTripHotelId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomNumber, roomType, capacity: Number(capacity) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      setRoomNumber("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm("Supprimer cette chambre ?")) return;
    await fetch(`/api/admin/rooms/${id}`, { method: "DELETE" });
    router.refresh();
  };

  // --- Affectation manuelle ---
  const handleAssign = async (registrationId, roomIdValue) => {
    setError(null);
    const res = await fetch(`/api/admin/registrations/${registrationId}/room`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomIdValue || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message);
      return;
    }
    router.refresh();
  };

  // Assigne tous les membres d'un groupe (binôme/famille) à la même chambre,
  // pour les garder ensemble en un clic plutôt que d'assigner un par un.
  const handleAssignGroup = async (members, roomIdValue) => {
    if (!roomIdValue) return;
    setError(null);
    for (const member of members) {
      const res = await fetch(`/api/admin/registrations/${member.id}/room`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: roomIdValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(`${member.full_name} : ${data.message}`);
        router.refresh();
        return;
      }
    }
    router.refresh();
  };

  // Une chambre est compatible si elle a de la place et si elle n'est pas
  // déjà occupée par l'autre genre — sauf pour un couple/famille du même
  // groupe (allow_mixed_gender_room), seule exception à la non-mixité. Le
  // serveur reste la source de vérité (voir assignRegistrationToRoom).
  const isRoomCompatible = (room, traveler) => {
    if (room.occupants_count >= room.capacity) return false;
    if (!room.occupants_gender) return true;
    const otherGenderPresent = room.occupants_gender
      .split(" + ")
      .some((g) => g !== traveler.gender);
    if (!otherGenderPresent) return true;
    return Boolean(traveler.group_id && traveler.allow_mixed_gender_room);
  };

  // --- Répartition automatique ---
  const handleAutoAssign = async () => {
    setError(null);
    setAutoAssignResult(null);
    const res = await fetch(`/api/admin/trips/${tripId}/auto-assign`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setAutoAssignResult(data);
    router.refresh();
  };

  // Regroupe les voyageurs non affectés par groupe d'inscription (binôme/
  // famille) pour les afficher et les assigner ensemble.
  const soloUnassigned = unassigned.filter((u) => !u.group_id);
  const groupedUnassigned = [];
  const seenGroupIds = new Set();
  for (const u of unassigned) {
    if (!u.group_id || seenGroupIds.has(u.group_id)) continue;
    seenGroupIds.add(u.group_id);
    groupedUnassigned.push({
      groupId: u.group_id,
      label: u.group_label,
      allowMixed: Boolean(u.allow_mixed_gender_room),
      members: unassigned.filter((x) => x.group_id === u.group_id),
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {/* Hôtels du voyage */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Hôtels du voyage</h2>
        <ul className="mt-3 divide-y divide-zinc-100">
          {tripHotels.map((th) => (
            <li key={th.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {th.hotel_name} ({th.city}) —{" "}
                {new Date(th.check_in_date).toLocaleDateString("fr-FR")} →{" "}
                {new Date(th.check_out_date).toLocaleDateString("fr-FR")}
              </span>
              {canManage && (
                <button
                  onClick={() => handleRemoveTripHotel(th.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
          {tripHotels.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">Aucun hôtel assigné.</li>
          )}
        </ul>

        {canManage && (
          <form onSubmit={handleAddHotel} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-zinc-700">Hôtel</label>
              <select
                required
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Sélectionner...</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Check-in</label>
              <input
                type="date"
                required
                min={tripDepartureDate}
                max={tripReturnDate}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Check-out</label>
              <input
                type="date"
                required
                min={tripDepartureDate}
                max={tripReturnDate}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Ajouter
            </button>
          </form>
        )}
      </section>

      {/* Chambres */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Chambres</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-2 py-2">Hôtel</th>
                <th className="px-2 py-2">N°</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Occupation</th>
                <th className="px-2 py-2">Genre</th>
                {canManage && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-2 py-2">{r.hotel_name}</td>
                  <td className="px-2 py-2">{r.room_number || "—"}</td>
                  <td className="px-2 py-2 capitalize">{r.room_type}</td>
                  <td className="px-2 py-2">
                    {r.occupants_count} / {r.capacity}
                  </td>
                  <td className="px-2 py-2 capitalize">{r.occupants_gender || "—"}</td>
                  {canManage && (
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => handleDeleteRoom(r.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td className="px-2 py-2 text-zinc-500" colSpan={6}>
                    Aucune chambre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && tripHotels.length > 0 && (
          <form onSubmit={handleCreateRoom} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
            <div className="min-w-[180px] flex-1">
              <label className="block text-sm font-medium text-zinc-700">Hôtel</label>
              <select
                required
                value={roomTripHotelId}
                onChange={(e) => setRoomTripHotelId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Sélectionner...</option>
                {tripHotels.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.hotel_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">N° chambre</label>
              <input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="mt-1 w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Capacité</label>
              <input
                type="number"
                value={capacity}
                disabled
                readOnly
                className="mt-1 w-20 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Créer la chambre
            </button>
          </form>
        )}
      </section>

      {/* Voyageurs non affectés */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Voyageurs non affectés ({unassigned.length})
          </h2>
          {canManage && unassigned.length > 0 && (
            <button
              onClick={handleAutoAssign}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Répartition automatique
            </button>
          )}
        </div>

        {autoAssignResult && (
          <p className="mt-2 text-sm text-emerald-700">
            {autoAssignResult.assignedCount} voyageur(s) affecté(s)
            {autoAssignResult.skippedCount > 0 &&
              `, ${autoAssignResult.skippedCount} en attente (pas de chambre compatible disponible)`}
            .
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {groupedUnassigned.map((g) => {
            const compatibleRooms = rooms.filter((r) => {
              const remaining = r.capacity - r.occupants_count;
              if (remaining < g.members.length) return false;
              return g.members.every((m) => isRoomCompatible(r, m));
            });
            return (
              <li
                key={g.groupId}
                className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {g.label}
                      {g.allowMixed && (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          (couple/famille — chambre mixte autorisée)
                        </span>
                      )}
                    </p>
                    <ul className="mt-1 space-y-0.5 divide-y-0 text-sm text-zinc-700">
                      {g.members.map((m) => (
                        <li key={m.id}>
                          {m.full_name}{" "}
                          <span className="capitalize text-zinc-500">({m.gender})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canManage && (
                    <select
                      defaultValue=""
                      onChange={(e) => handleAssignGroup(g.members, e.target.value)}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                    >
                      <option value="">Assigner le groupe à...</option>
                      {compatibleRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.hotel_name} — {r.room_type} {r.room_number} (
                          {r.occupants_count}/{r.capacity})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}

          {soloUnassigned.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0"
            >
              <span>
                {u.full_name} <span className="capitalize text-zinc-500">({u.gender})</span>
                {(u.preferred_hotel_name || u.preferred_room_type) && (
                  <span className="ml-2 text-xs text-emerald-700">
                    souhaite : {u.preferred_hotel_name || "—"}
                    {u.preferred_room_type ? ` — ${u.preferred_room_type}` : ""}
                  </span>
                )}
              </span>
              {canManage && (
                <select
                  defaultValue=""
                  onChange={(e) => handleAssign(u.id, e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                >
                  <option value="">Assigner à...</option>
                  {rooms
                    .filter((r) => isRoomCompatible(r, u))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.hotel_name} — {r.room_type} {r.room_number} (
                        {r.occupants_count}/{r.capacity})
                      </option>
                    ))}
                </select>
              )}
            </li>
          ))}

          {unassigned.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">
              Tous les voyageurs sont affectés.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
