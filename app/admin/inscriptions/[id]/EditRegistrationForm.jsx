"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BOOKABLE_ROOM_TYPES } from "@/lib/roomTypes";

const STATUS_OPTIONS = ["inscrit", "confirme", "paye_partiel", "paye_complet", "annule"];
const VISA_OPTIONS = ["non_demande", "en_cours", "accorde", "refuse"];

// canEditStatus/canEditFinance/canEditVisa restent basés sur le rôle brut
// (pas sur le système de permissions dynamique) : ce sont des restrictions
// fines par champ sur UN SEUL endpoint (PUT .../registrations/[id]), pas des
// permissions d'accès à une action — voir CLAUDE.md. La préférence
// hébergement suit le même groupe que "status" (ventes/direction).
export default function EditRegistrationForm({
  registration,
  role,
  canDelete,
  tripHotels = [],
  hotelPreferences = [],
  tripGroups = [],
}) {
  const router = useRouter();
  const [status, setStatus] = useState(registration.status);
  const [visaStatus, setVisaStatus] = useState(registration.visa_status);
  const [totalDue, setTotalDue] = useState(registration.total_due);
  const [notes, setNotes] = useState(registration.notes || "");
  // Une préférence d'hôtel par ville (Mecque + Médine — §3quattuorvicies) :
  // { [ville]: hotelId }.
  const [hotelPreferencesByCity, setHotelPreferencesByCity] = useState(
    Object.fromEntries(hotelPreferences.map((p) => [p.city, String(p.hotel_id)]))
  );
  const [preferredRoomType, setPreferredRoomType] = useState(
    registration.preferred_room_type || ""
  );
  const [groupMode, setGroupMode] = useState(
    registration.group_id ? "existant" : "aucun"
  );
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [allowMixedGenderRoom, setAllowMixedGenderRoom] = useState(false);
  const [existingGroupId, setExistingGroupId] = useState(registration.group_id || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canEditStatus = ["direction", "ventes"].includes(role);
  const canEditFinance = ["direction", "comptabilite"].includes(role);
  const canEditVisa = ["direction", "suivi"].includes(role);

  const tripHotelsByCity = [];
  const seenCities = new Map();
  for (const th of tripHotels) {
    if (!seenCities.has(th.city)) {
      seenCities.set(th.city, { city: th.city, items: [] });
      tripHotelsByCity.push(seenCities.get(th.city));
    }
    seenCities.get(th.city).items.push(th);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {};
      if (canEditStatus) {
        payload.status = status;
        payload.hotelPreferences = Object.entries(hotelPreferencesByCity)
          .filter(([, hotelId]) => hotelId)
          .map(([city, hotelId]) => ({ city, hotelId }));
        payload.preferredRoomType = preferredRoomType || null;

        if (groupMode === "nouveau" && newGroupLabel.trim()) {
          const groupRes = await fetch(
            `/api/admin/trips/${registration.trip_id}/groups`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label: newGroupLabel.trim(), allowMixedGenderRoom }),
            }
          );
          const groupData = await groupRes.json();
          if (!groupRes.ok) {
            throw new Error(groupData.message || "Erreur lors de la création du groupe");
          }
          payload.groupId = groupData.id;
        } else if (groupMode === "existant") {
          payload.groupId = existingGroupId || null;
        } else {
          payload.groupId = null;
        }
      }
      if (canEditVisa) payload.visaStatus = visaStatus;
      if (canEditFinance && !registration.group_id) payload.totalDue = Number(totalDue);
      payload.notes = notes;

      const res = await fetch(`/api/admin/registrations/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la mise à jour");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement cette inscription ?")) return;
    await fetch(`/api/admin/registrations/${registration.id}`, { method: "DELETE" });
    router.push("/admin/inscriptions");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select
            disabled={!canEditStatus}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut visa</label>
          <select
            disabled={!canEditVisa}
            value={visaStatus}
            onChange={(e) => setVisaStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canEditStatus && (
        <div className="space-y-4">
          {tripHotelsByCity.length > 0 && (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${tripHotelsByCity.length}, minmax(0, 1fr))` }}
            >
              {tripHotelsByCity.map((group) => (
                <div key={group.city}>
                  <label className="block text-sm font-medium text-zinc-700">
                    Hôtel souhaité — {group.city}
                  </label>
                  <select
                    value={hotelPreferencesByCity[group.city] || ""}
                    onChange={(e) =>
                      setHotelPreferencesByCity((prev) => ({
                        ...prev,
                        [group.city]: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">Aucune préférence</option>
                    {group.items.map((th) => (
                      <option key={th.hotel_id} value={th.hotel_id}>
                        {th.hotel_name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-zinc-700">
              Type de chambre souhaité
            </label>
            <select
              value={preferredRoomType}
              onChange={(e) => setPreferredRoomType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Aucune préférence</option>
              {BOOKABLE_ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {canEditStatus && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="block text-sm font-medium text-zinc-700">
            Groupe / binôme
          </label>
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="aucun">Voyageur seul</option>
            <option value="nouveau">Créer un nouveau groupe</option>
            <option value="existant" disabled={tripGroups.length === 0}>
              Rejoindre un groupe existant
            </option>
          </select>

          {groupMode === "nouveau" && (
            <div className="mt-3 space-y-2">
              <input
                required
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder="Nom du groupe (ex. Famille Alaoui, M. et Mme Idrissi)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={allowMixedGenderRoom}
                  onChange={(e) => setAllowMixedGenderRoom(e.target.checked)}
                />
                Couple / famille — autoriser à partager une chambre entre
                genres différents
              </label>
            </div>
          )}

          {groupMode === "existant" && (
            <select
              required
              value={existingGroupId}
              onChange={(e) => setExistingGroupId(e.target.value)}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Sélectionner un groupe...</option>
              {tripGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} ({g.member_count} inscrit
                  {g.member_count > 1 ? "s" : ""}
                  {g.allow_mixed_gender_room ? " — couple/famille" : ""})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {registration.group_id ? (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Montant dû (MAD)</label>
          <p className="mt-1 text-sm text-zinc-500">
            Suivi au niveau du groupe —{" "}
            <Link
              href={`/admin/groupes/${registration.group_id}`}
              className="text-emerald-700 hover:underline"
            >
              voir/modifier sur la page du groupe
            </Link>
            .
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Montant dû (MAD)</label>
          <input
            type="number"
            step="0.01"
            disabled={!canEditFinance}
            value={totalDue}
            onChange={(e) => setTotalDue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer l&apos;inscription
          </button>
        )}
      </div>
    </form>
  );
}
