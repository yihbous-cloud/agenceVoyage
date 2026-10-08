"use client";

import {
  PACKAGE_TYPES,
  PACKAGE_LABELS,
  DISCOUNT_TYPES,
  DISCOUNT_LABELS,
  DISCOUNT_REASONS,
  DISCOUNT_REASON_LABELS,
  computeRegistrationPrice,
} from "@/lib/roomTypes";
import { formatMoney } from "@/app/admin/_components/statusStyles";

// Formule achetée + réduction d'une inscription (CLAUDE.md, migration 042),
// partagé entre la création (NewRegistrationForm) et la fiche
// (EditRegistrationForm). Le calcul affiché est le même que celui du serveur
// (computeRegistrationPrice) ; le serveur reste l'autorité (plafond, gratuité).
// discountCap n'est transmis que pour l'administrateur.
export const EMPTY_PRICING = {
  packageType: "complet",
  discountType: "aucune",
  discountValue: "",
  discountReason: "",
  discountNote: "",
};

export function pricingFromRegistration(r) {
  return {
    packageType: r.package_type || "complet",
    discountType: r.discount_type || "aucune",
    discountValue: r.discount_value ?? "",
    discountReason: r.discount_reason || "",
    discountNote: r.discount_note || "",
  };
}

export function pricingPayload(v) {
  const hasValue = v.discountType === "montant" || v.discountType === "pourcentage";
  const hasDiscount = v.discountType !== "aucune";
  return {
    packageType: v.packageType,
    discountType: v.discountType,
    discountValue: hasValue ? Number(v.discountValue) || 0 : null,
    discountReason: hasDiscount ? v.discountReason || null : null,
    discountNote: hasDiscount ? v.discountNote || null : null,
  };
}

export default function PricingFields({
  value,
  onChange,
  disabled = false,
  fullPrice,
  flightOnlyPrice,
  canAdminDiscount = false,
  discountCap = null,
  currentDue = null,
  travelersCount = 1,
}) {
  const set = (patch) => onChange({ ...value, ...patch });
  const price = computeRegistrationPrice({
    fullPrice,
    flightOnlyPrice,
    packageType: value.packageType,
    discountType: value.discountType,
    discountValue: value.discountValue,
  });
  const noFlightPrice = value.packageType !== "complet" && !(Number(flightOnlyPrice) > 0);
  const overCap =
    !canAdminDiscount &&
    value.discountType !== "aucune" &&
    value.discountType !== "gratuite" &&
    discountCap !== null &&
    price.discountAmount > Number(discountCap);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Formule et réduction</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Formule</label>
          <select
            disabled={disabled}
            value={value.packageType}
            onChange={(e) => set({ packageType: e.target.value })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {PACKAGE_TYPES.map((p) => (
              <option key={p} value={p}>
                {PACKAGE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Réduction</label>
          <select
            disabled={disabled}
            value={value.discountType}
            onChange={(e) => set({ discountType: e.target.value, discountValue: "" })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {DISCOUNT_TYPES.map((d) => (
              <option key={d} value={d} disabled={d === "gratuite" && !canAdminDiscount && value.discountType !== "gratuite"}>
                {DISCOUNT_LABELS[d]}
                {d === "gratuite" && !canAdminDiscount ? " (administrateur)" : ""}
              </option>
            ))}
          </select>
        </div>

        {(value.discountType === "montant" || value.discountType === "pourcentage") && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              {value.discountType === "montant" ? "Montant de la réduction (MAD)" : "Pourcentage de réduction (%)"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={value.discountType === "pourcentage" ? 100 : undefined}
              required
              disabled={disabled}
              value={value.discountValue}
              onChange={(e) => set({ discountValue: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        )}

        {value.discountType !== "aucune" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">Motif</label>
            <select
              required
              disabled={disabled}
              value={value.discountReason}
              onChange={(e) => set({ discountReason: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              <option value="">Choisir le motif...</option>
              {DISCOUNT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {DISCOUNT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        )}

        {value.discountType !== "aucune" && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Note (facultatif)</label>
            <input
              disabled={disabled}
              maxLength={255}
              value={value.discountNote}
              onChange={(e) => set({ discountNote: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        )}
      </div>

      {canAdminDiscount && value.discountType !== "aucune" && (
        <p className="text-xs text-zinc-500">
          {discountCap === null
            ? "Aucun plafond défini pour ce programme : seul l'administrateur peut accorder une réduction."
            : `Plafond de réduction de ce programme : ${formatMoney(discountCap)} MAD (visible par l'administrateur seulement).`}
        </p>
      )}
      {overCap && (
        <p className="text-sm text-amber-700">
          Cette réduction dépasse le plafond autorisé pour ce programme : demandez l&apos;accord de l&apos;administrateur.
        </p>
      )}
      {noFlightPrice && (
        <p className="text-sm text-amber-700">
          Le prix « billet seul » de ce voyage n&apos;est pas renseigné (carte « Formules et réductions » du programme).
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Prix de la formule</dt>
          <dd className="font-medium">{formatMoney(price.basePrice)} MAD</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Réduction</dt>
          <dd className="font-medium text-red-600">
            {price.discountAmount > 0 ? `− ${formatMoney(price.discountAmount)} MAD` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">
            {travelersCount > 1 ? "Net à payer (par voyageur)" : "Net à payer"}
          </dt>
          <dd className="font-semibold text-emerald-700">{formatMoney(price.netPrice)} MAD</dd>
        </div>
      </dl>
      {currentDue !== null && Math.abs(Number(currentDue) - price.netPrice) > 0.005 && (
        <p className="text-xs text-zinc-500">
          {`Montant dû enregistré : ${formatMoney(currentDue)} MAD — il sera remplacé par le net ci-dessus à l'enregistrement.`}
        </p>
      )}
    </div>
  );
}
