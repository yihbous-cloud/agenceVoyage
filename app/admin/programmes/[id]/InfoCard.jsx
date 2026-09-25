"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AIRPORTS } from "@/lib/airports";

const PROGRAM_TYPES = ["omra", "hajj", "tourisme", "autre"];
const FAMILIES = [
  { value: "omra_hajj", label: "Omra & Hajj" },
  { value: "voyage_organise", label: "Voyage organisé" },
];
const TRIP_STATUSES = ["planifie", "ouvert", "complet", "en_cours", "termine", "annule"];

export default function InfoCard({ program, trip, canManage }) {
  const router = useRouter();

  const [title, setTitle] = useState(program.title || "");
  const [programType, setProgramType] = useState(program.program_type || "omra");
  const [family, setFamily] = useState(program.family || "omra_hajj");
  const [theme, setTheme] = useState(program.theme || "");

  const [referenceCode, setReferenceCode] = useState(trip?.reference_code || "");
  const [status, setStatus] = useState(trip?.status || "planifie");
  const [departureDate, setDepartureDate] = useState(trip?.departure_date || "");
  const [returnDate, setReturnDate] = useState(trip?.return_date || "");
  const [originIata, setOriginIata] = useState(trip?.origin_iata || "");
  const [destinationCountry, setDestinationCountry] = useState(
    trip?.destination_country || "Arabie Saoudite"
  );
  const [destinationCity, setDestinationCity] = useState(trip?.destination_city || "");

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const programRes = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          programType,
          family,
          theme: family === "voyage_organise" ? theme || null : null,
        }),
      });
      if (!programRes.ok) {
        const data = await programRes.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement du programme");
      }

      if (trip) {
        const tripRes = await fetch(`/api/admin/trips/${trip.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceCode,
            status,
            departureDate,
            returnDate,
            originIata: originIata || null,
            destinationCountry,
            destinationCity: destinationCity || null,
          }),
        });
        if (!tripRes.ok) {
          const data = await tripRes.json();
          throw new Error(data.message || "Erreur lors de l'enregistrement du voyage");
        }
      }

      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce programme ?")) return;
    const res = await fetch(`/api/admin/programs/${program.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message);
      return;
    }
    router.push("/admin/programmes");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Informations</h2>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Titre</label>
        <input
          required
          disabled={!canManage}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Type</label>
          <select
            disabled={!canManage}
            value={programType}
            onChange={(e) => setProgramType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {PROGRAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Famille</label>
          <select
            required
            disabled={!canManage}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {family === "voyage_organise" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Thème / envie</label>
          <input
            disabled={!canManage}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      )}

      {trip ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Référence</label>
              <input
                required
                disabled={!canManage}
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Statut</label>
              <select
                disabled={!canManage}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              >
                {TRIP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date d&apos;aller</label>
              <input
                type="date"
                required
                disabled={!canManage}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date de retour</label>
              <input
                type="date"
                required
                disabled={!canManage}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Ville de départ (Maroc)
            </label>
            <select
              disabled={!canManage}
              value={originIata}
              onChange={(e) => setOriginIata(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              <option value="">Sélectionner...</option>
              {Object.entries(AIRPORTS).map(([iata, info]) => (
                <option key={iata} value={iata}>
                  {info.city} ({iata})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Pays de destination
              </label>
              <input
                disabled={!canManage}
                value={destinationCountry}
                onChange={(e) => {
                  setDestinationCountry(e.target.value);
                  setDestinationCity("");
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Ville de destination
              </label>
              <input
                disabled={!canManage}
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Ce programme n&apos;a aucun voyage — les dates, l&apos;aéroport de départ et la
          destination se renseignent une fois un voyage créé (liste des voyages ci-dessous).
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer ce programme
          </button>
        </div>
      )}
    </form>
  );
}
