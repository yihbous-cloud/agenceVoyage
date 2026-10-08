"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../_components/Icon";
import {
  AIRPORTS_REFERENCE,
  airportInputValue,
  extractIataFromInput,
  formatAirportOption,
} from "@/lib/airportsReference";
import { TICKET_STATUS, TRAVEL_CLASS_LABELS, TRIP_TYPE_LABELS, formatMoney } from "./ticketSaleLabels";

// Formulaire de vente de billet d'avion (création ET modification) —
// migration 036. En création, il porte aussi les informations du client
// (réutilisé par numéro WhatsApp côté serveur).
function initialForm(sale) {
  return {
    fullName: "",
    gender: "homme",
    phoneWhatsapp: "",
    email: "",
    airlineId: sale?.airline_id ? String(sale.airline_id) : "",
    tripType: sale?.trip_type || "aller_retour",
    origin: sale?.origin_iata ? airportInputValue(sale.origin_iata) : "",
    destination: sale?.destination_iata ? airportInputValue(sale.destination_iata) : "",
    departureDate: sale?.departure_date ? String(sale.departure_date).slice(0, 10) : "",
    returnDate: sale?.return_date ? String(sale.return_date).slice(0, 10) : "",
    passengersCount: String(sale?.passengers_count || 1),
    passengerNames: sale?.passenger_names || "",
    travelClass: sale?.travel_class || "economique",
    pnr: sale?.pnr || "",
    ticketNumbers: sale?.ticket_numbers || "",
    purchasePrice: sale ? String(Number(sale.purchase_price)) : "",
    totalDue: sale ? String(Number(sale.total_due)) : "",
    status: sale?.status || "reserve",
    notes: sale?.notes || "",
  };
}

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";

export default function TicketSaleForm({ sale = null, airlines, canManage = true }) {
  const router = useRouter();
  const isEdit = Boolean(sale);
  const [form, setForm] = useState(() => initialForm(sale));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const margin = (Number(form.totalDue) || 0) - (Number(form.purchasePrice) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const payload = {
      ...form,
      originIata: extractIataFromInput(form.origin),
      destinationIata: extractIataFromInput(form.destination),
      airlineId: form.airlineId || null,
      returnDate: form.tripType === "aller_retour" ? form.returnDate : null,
    };
    try {
      const res = await fetch(isEdit ? `/api/admin/ticket-sales/${sale.id}` : "/api/admin/ticket-sales", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Enregistrement impossible");
      if (isEdit) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/admin/billets/${data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !canManage;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <datalist id="ticket-airports">
        {AIRPORTS_REFERENCE.map((a) => (
          <option key={a.iata} value={formatAirportOption(a)} />
        ))}
      </datalist>

      {!isEdit && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-zinc-900">Client</legend>
          <label className="text-sm font-medium">
            Nom complet
            <input required value={form.fullName} onChange={set("fullName")} className={input} />
          </label>
          <label className="text-sm font-medium">
            Genre
            <select value={form.gender} onChange={set("gender")} className={input}>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            N° WhatsApp
            <input required value={form.phoneWhatsapp} onChange={set("phoneWhatsapp")} className={input} />
          </label>
          <label className="text-sm font-medium">
            Email (optionnel)
            <input type="email" value={form.email} onChange={set("email")} className={input} />
          </label>
        </fieldset>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-semibold text-zinc-900">Vol</legend>
        <label className="text-sm font-medium">
          Compagnie aérienne
          <select value={form.airlineId} onChange={set("airlineId")} className={input}>
            <option value="">— Non précisée —</option>
            {airlines.map((a) => (
              <option key={a.id} value={a.id} translate="no">
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Type de trajet
          <select value={form.tripType} onChange={set("tripType")} className={input}>
            {Object.entries(TRIP_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Aéroport de départ
          <input
            list="ticket-airports"
            value={form.origin}
            onChange={set("origin")}
            placeholder="ex. Casablanca (CMN)"
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Aéroport d&apos;arrivée
          <input
            list="ticket-airports"
            value={form.destination}
            onChange={set("destination")}
            placeholder="ex. Djeddah (JED)"
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Date de départ
          <input type="date" value={form.departureDate} onChange={set("departureDate")} className={input} />
        </label>
        {form.tripType === "aller_retour" && (
          <label className="text-sm font-medium">
            Date de retour
            <input
              type="date"
              value={form.returnDate}
              min={form.departureDate || undefined}
              onChange={set("returnDate")}
              className={input}
            />
          </label>
        )}
        <label className="text-sm font-medium">
          Nombre de passagers
          <input type="number" min="1" value={form.passengersCount} onChange={set("passengersCount")} className={input} />
        </label>
        <label className="text-sm font-medium">
          Classe
          <select value={form.travelClass} onChange={set("travelClass")} className={input}>
            {Object.entries(TRAVEL_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Noms des passagers (si plusieurs)
          <input
            value={form.passengerNames}
            onChange={set("passengerNames")}
            placeholder="ex. Ahmed Alaoui, Fatima Alaoui"
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          PNR (référence de réservation)
          <input value={form.pnr} onChange={set("pnr")} maxLength={10} className={`${input} uppercase`} />
        </label>
        <label className="text-sm font-medium">
          N° de billet(s)
          <input value={form.ticketNumbers} onChange={set("ticketNumbers")} className={input} />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={disabled}>
        <legend className="mb-2 text-sm font-semibold text-zinc-900">Prix</legend>
        <label className="text-sm font-medium">
          Prix d&apos;achat (MAD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePrice}
            onChange={set("purchasePrice")}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          Prix de vente (MAD)
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.totalDue}
            onChange={set("totalDue")}
            className={input}
          />
        </label>
        <div className="text-sm font-medium">
          Marge
          <div
            className="mt-1 flex h-[38px] items-center rounded-lg px-3 font-semibold"
            style={{
              background: margin < 0 ? "#fdecec" : "#e6f4ee",
              color: margin < 0 ? "#c4373b" : "#0f6b4b",
            }}
          >
            {formatMoney(margin)} MAD
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
        <label className="text-sm font-medium">
          Statut
          <select value={form.status} onChange={set("status")} className={input}>
            {Object.entries(TICKET_STATUS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Notes
          <textarea rows={2} value={form.notes} onChange={set("notes")} className={input} />
        </label>
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <Icon name="check_circle" size={16} fill />
          Vente enregistrée.
        </p>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="gf-btn-primary disabled:opacity-60">
            <Icon name={isEdit ? "check_circle" : "add"} size={18} />
            {submitting ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer la vente"}
          </button>
        </div>
      )}
    </form>
  );
}
