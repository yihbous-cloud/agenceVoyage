"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKABLE_ROOM_TYPES, pickTripPrice, pickTierPrice } from "@/lib/roomTypes";
import PricingFields, { pricingFromRegistration, pricingPayload } from "@/app/admin/inscriptions/PricingFields";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

const STATUS_OPTIONS = ["inscrit", "confirme", "paye_partiel", "paye_complet", "annule"];

// canEditStatus restent basés sur le rôle brut (pas sur le système de
// permissions dynamique) : ce sont des restrictions fines par champ sur UN
// SEUL endpoint (PUT .../registrations/[id]), pas des permissions d'accès à
// une action — voir CLAUDE.md. Statut visa et Montant dû ont été extraits
// vers des cartes dédiées (VisaStatusForm.jsx, GroupDueForm.jsx réutilisé) —
// voir §3soixantequadragies : ce composant ne gère plus que "Informations
// Voyageurs" (statut, hébergement, groupe, notes).
// showStatusAndNotes=false (carte "Hébergement et Paiement", §3soixante-
// troisquadragies) : Statut/Notes en sont retirés — Statut devient un
// widget toujours modifiable et auto-actualisé à part (StatusNotesForm.jsx),
// Notes le rejoint au même endroit. Reste à `true` (défaut) pour l'usage
// existant dans la modale par membre de GroupManagerGrid.jsx, inchangé.
export default function EditRegistrationForm({
  registration,
  role,
  canDelete,
  tripGroups = [],
  tiers = [],
  initialMode = "view",
  stayOnPage = false,
  showStatusAndNotes = true,
  canAdminDiscount = false,
  discountCap = null,
  onSuccess,
}) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  const [status, setStatus] = useState(registration.status);
  const [notes, setNotes] = useState(registration.notes || "");
  const [preferredRoomType, setPreferredRoomType] = useState(
    registration.preferred_room_type || ""
  );
  // Tarif d'hébergement (Omra/Hajj uniquement, tiers non vide — voir
  // CLAUDE.md) : même state qu'à la création, ajouté ici pour rester
  // modifiable après coup, pas seulement à l'inscription.
  const [selectedTierId, setSelectedTierId] = useState(
    registration.selected_tier_id ? String(registration.selected_tier_id) : ""
  );
  // Verrouillage de TOUT le formulaire — même principe que
  // EditTravelerForm : "Afficher" (mode par défaut) ouvre la fiche
  // verrouillée (tous les champs déjà remplis en lecture seule),
  // "Modifier" (?mode=edit, voir page.js) ou le lien "Modifier" local
  // déverrouille.
  const [formLocked, setFormLocked] = useState(initialMode !== "edit");
  const [groupMode, setGroupMode] = useState(
    registration.group_id ? "existant" : "aucun"
  );
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [allowMixedGenderRoom, setAllowMixedGenderRoom] = useState(false);
  const [existingGroupId, setExistingGroupId] = useState(registration.group_id || "");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const canEditStatus = ["direction", "ventes"].includes(role);
  // Formule / réduction : aussi la comptabilité (lib/registrationPricing.js
  // contrôle le plafond et la gratuité côté serveur).
  const canEditPricing = ["direction", "ventes", "comptabilite"].includes(role);
  const [pricing, setPricing] = useState(() => pricingFromRegistration(registration));
  const selectedTier = tiers.find((t) => String(t.id) === String(selectedTierId));
  const tierPrice = selectedTier ? pickTierPrice(selectedTier.prices, preferredRoomType) : null;
  const fullPrice = tierPrice ?? (registration.price_double !== undefined ? pickTripPrice(registration, preferredRoomType) : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {};
      if (canEditStatus) {
        if (showStatusAndNotes) payload.status = status;
        payload.preferredRoomType = preferredRoomType || null;
        payload.selectedTierId = selectedTierId || null;

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
      if (canEditPricing) Object.assign(payload, pricingPayload(pricing));
      if (showStatusAndNotes) payload.notes = notes;

      const res = await fetch(`/api/admin/registrations/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la mise à jour");
      }
      setFormLocked(true);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = () => setFormLocked(false);

  const handleDelete = async () => {
    if (!(await confirm("Supprimer définitivement cette inscription ?"))) return;
    await fetch(`/api/admin/registrations/${registration.id}`, { method: "DELETE" });
    if (stayOnPage) {
      router.refresh();
    } else {
      router.push("/admin/inscriptions");
      router.refresh();
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      {formLocked && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Verrouillé après enregistrement</span>
          <button
            type="button"
            onClick={handleUnlock}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Modifier
          </button>
        </div>
      )}

      {showStatusAndNotes && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Statut</label>
          <select
            disabled={!canEditStatus || formLocked}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {canEditStatus && (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Préférence d&apos;hébergement</h3>

          {tiers.length > 0 && (
            <div className="max-w-md">
              <label className="block text-sm font-medium text-zinc-700">
                Tarif d&apos;hébergement
              </label>
              <select
                disabled={formLocked}
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              >
                <option value="">Aucun (prix plat du voyage)</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label} — {tier.makkah_hotel_name} + {tier.madinah_hotel_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-zinc-700">
              Type de chambre souhaité
            </label>
            <select
              disabled={formLocked}
              value={preferredRoomType}
              onChange={(e) => setPreferredRoomType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
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

      {canEditPricing && (
        <PricingFields
          value={pricing}
          onChange={setPricing}
          disabled={formLocked}
          fullPrice={fullPrice}
          flightOnlyPrice={registration.price_flight_only}
          canAdminDiscount={canAdminDiscount}
          discountCap={discountCap}
          currentDue={registration.group_id ? null : registration.total_due}
        />
      )}

      {canEditStatus && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="block text-sm font-medium text-zinc-700">
            Groupe / binôme
          </label>
          <select
            disabled={formLocked}
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
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
                disabled={formLocked}
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder="Nom du groupe (ex. Famille Alaoui, M. et Mme Idrissi)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  disabled={formLocked}
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
              disabled={formLocked}
              value={existingGroupId}
              onChange={(e) => setExistingGroupId(e.target.value)}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              <option value="">Sélectionner un groupe...</option>
              {tripGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {`${g.label} (${tr.plural("{count} inscrit", "{count} inscrits", g.member_count)}${
                    g.allow_mixed_gender_room ? ` — ${tr("couple/famille")}` : ""
                  })`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {showStatusAndNotes && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Notes</label>
          <textarea
            disabled={formLocked}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!formLocked && (
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
      )}
    </form>
    {confirmDialog}
    </>
  );
}
