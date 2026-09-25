"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOM_TYPE_CAPACITY, BOOKABLE_ROOM_TYPES } from "@/lib/roomTypes";

export default function HebergementManager({
  tripId,
  tripDepartureDate,
  tripReturnDate,
  hotels,
  tripHotels,
  rooms,
  unassigned,
  assigned,
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

  // Un voyage peut avoir des hôtels dans plusieurs villes (ex. Omra :
  // Mecque + Médine) — regroupe hôtels/chambres par ville pour que
  // l'affectation se fasse dans la bonne ville, pas au hasard sur une
  // liste à plat (voir CLAUDE.md).
  const groupByCity = (items, cityKey) => {
    const groups = [];
    const seen = new Map();
    for (const item of items) {
      const city = item[cityKey] || "Autre";
      if (!seen.has(city)) {
        seen.set(city, { city, items: [] });
        groups.push(seen.get(city));
      }
      seen.get(city).items.push(item);
    }
    return groups;
  };

  const tripHotelsByCity = groupByCity(tripHotels, "city");
  const roomsByCity = groupByCity(rooms, "hotel_city");

  // Un voyageur avec une préférence hôtel/type exprimée à l'inscription
  // (§3quaterdecies) n'a pas besoin de voir tous les hôtels/chambres du
  // voyage dans "Assigner à..." — seulement les chambres qui correspondent
  // à ce qu'il a demandé. Depuis §3quattuorvicies, hotelPreferences est un
  // tableau (une préférence par ville, ex. Mecque + Médine) : une chambre
  // matche si son hôtel figure dans l'une des préférences, quelle que soit
  // la ville. Si aucune ne correspond, retombe sur la liste complète pour
  // ne jamais bloquer l'affectation.
  const filterByPreference = (roomsList, hotelPreferences, preferredRoomType) => {
    if (!hotelPreferences || hotelPreferences.length === 0) return roomsList;
    const preferredHotelIds = hotelPreferences.map((p) => p.hotel_id);
    const hotelMatches = roomsList.filter((r) => preferredHotelIds.includes(r.hotel_id));
    if (hotelMatches.length === 0) return roomsList;
    if (!preferredRoomType) return hotelMatches;
    const typeMatches = hotelMatches.filter((r) => r.room_type === preferredRoomType);
    return typeMatches.length > 0 ? typeMatches : hotelMatches;
  };

  // Voyageurs déjà affectés, groupés par chambre — pour vérifier que
  // l'affectation réelle correspond à la préférence exprimée à
  // l'inscription (§3quaterdecies) : un changement manuel ou une
  // répartition automatique peut placer quelqu'un dans une chambre
  // différente de celle demandée sans que ça saute aux yeux une fois la
  // chambre marquée "occupée" (voir CLAUDE.md).
  const occupantsByRoom = new Map();
  for (const a of assigned) {
    if (!occupantsByRoom.has(a.room_id)) occupantsByRoom.set(a.room_id, []);
    occupantsByRoom.get(a.room_id).push(a);
  }

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
        <div className="mt-3 space-y-4">
          {tripHotelsByCity.map((group) => (
            <div key={group.city}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {group.city}
              </h3>
              <ul className="mt-1 divide-y divide-zinc-100">
                {group.items.map((th) => (
                  <li key={th.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {th.hotel_name} —{" "}
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
              </ul>
            </div>
          ))}
          {tripHotels.length === 0 && (
            <p className="py-2 text-sm text-zinc-500">Aucun hôtel assigné.</p>
          )}
        </div>

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
                {groupByCity(hotels, "city").map((group) => (
                  <optgroup key={group.city} label={group.city}>
                    {group.items.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </optgroup>
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
        <div className="mt-3 space-y-4 overflow-x-auto">
          {roomsByCity.map((group) => (
            <div key={group.city}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {group.city}
              </h3>
              <table className="mt-1 w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Hôtel</th>
                    <th className="px-2 py-2">N°</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Occupation</th>
                    <th className="px-2 py-2">Genre</th>
                    <th className="px-2 py-2">Voyageurs</th>
                    {canManage && <th className="px-2 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((r) => {
                    const occupants = occupantsByRoom.get(r.id) || [];
                    return (
                    <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-2 py-2">{r.hotel_name}</td>
                      <td className="px-2 py-2">{r.room_number || "—"}</td>
                      <td className="px-2 py-2 capitalize">{r.room_type}</td>
                      <td className="px-2 py-2">
                        {r.occupants_count} / {r.capacity}
                      </td>
                      <td className="px-2 py-2 capitalize">{r.occupants_gender || "—"}</td>
                      <td className="px-2 py-2">
                        {occupants.length === 0 ? (
                          "—"
                        ) : (
                          <ul className="space-y-0.5">
                            {occupants.map((o) => {
                              const hotelMismatch =
                                o.preferred_hotel_id && o.preferred_hotel_id !== r.hotel_id;
                              const typeMismatch =
                                o.preferred_room_type && o.preferred_room_type !== r.room_type;
                              return (
                                <li key={o.id} className="flex items-center gap-1">
                                  <span>
                                    {o.full_name}
                                    {(hotelMismatch || typeMismatch) && (
                                      <span className="ml-1 text-xs font-medium text-amber-600">
                                        ⚠ avait demandé{" "}
                                        {[
                                          hotelMismatch ? o.preferred_hotel_name : null,
                                          typeMismatch ? o.preferred_room_type : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" — ")}
                                      </span>
                                    )}
                                  </span>
                                  {canManage && (
                                    <button
                                      onClick={() => handleAssign(o.id, "")}
                                      className="text-xs text-red-600 hover:underline"
                                    >
                                      Retirer
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {rooms.length === 0 && <p className="py-2 text-sm text-zinc-500">Aucune chambre.</p>}
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
                {tripHotelsByCity.map((group) => (
                  <optgroup key={group.city} label={group.city}>
                    {group.items.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.hotel_name}
                      </option>
                    ))}
                  </optgroup>
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
                {BOOKABLE_ROOM_TYPES.map((t) => (
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
                      {groupByCity(
                        filterByPreference(
                          compatibleRooms,
                          g.members[0]?.hotelPreferences,
                          g.members[0]?.preferred_room_type
                        ),
                        "hotel_city"
                      ).map((group) => (
                        <optgroup key={group.city} label={group.city}>
                          {group.items.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.hotel_name} — {r.room_type} {r.room_number} (
                              {r.occupants_count}/{r.capacity})
                            </option>
                          ))}
                        </optgroup>
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
                {(u.hotelPreferences?.length > 0 || u.preferred_room_type) && (
                  <span className="ml-2 text-xs text-emerald-700">
                    souhaite :{" "}
                    {u.hotelPreferences?.length > 0
                      ? u.hotelPreferences
                          .map((p) => `${p.city} → ${p.hotel_name}`)
                          .join(", ")
                      : "—"}
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
                  {groupByCity(
                    filterByPreference(
                      rooms.filter((r) => isRoomCompatible(r, u)),
                      u.hotelPreferences,
                      u.preferred_room_type
                    ),
                    "hotel_city"
                  ).map((group) => (
                    <optgroup key={group.city} label={group.city}>
                      {group.items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.hotel_name} — {r.room_type} {r.room_number} (
                          {r.occupants_count}/{r.capacity})
                        </option>
                      ))}
                    </optgroup>
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
