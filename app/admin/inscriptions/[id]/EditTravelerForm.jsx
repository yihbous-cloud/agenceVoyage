"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Format générique observé sur la plupart des passeports : lettres et
// chiffres, 6 à 9 caractères. Vérification de forme uniquement — aucune
// consultation d'un registre officiel.
const PASSPORT_FORMAT = /^[A-Za-z0-9]{6,9}$/;

export default function EditTravelerForm({ registration, role }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(registration.full_name);
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(registration.phone_whatsapp);
  const [gender, setGender] = useState(registration.gender);
  const [passportNumber, setPassportNumber] = useState(registration.passport_number || "");
  const [passportExpiryDate, setPassportExpiryDate] = useState(
    registration.passport_expiry_date || ""
  );
  const [email, setEmail] = useState(registration.traveler_email || "");
  const [passportCheck, setPassportCheck] = useState(null);
  const [expiryError, setExpiryError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = ["direction", "ventes"].includes(role);

  const handlePassportBlur = () => {
    const value = passportNumber.trim();
    if (!value) {
      setPassportCheck(null);
      return;
    }
    setPassportCheck(
      PASSPORT_FORMAT.test(value)
        ? { ok: true, message: "Vérification effectuée : le numéro de passeport est valide." }
        : {
            ok: false,
            message:
              "Le numéro de passeport semble incorrect (6 à 9 lettres/chiffres attendus). Merci de vérifier la saisie.",
          }
    );
  };

  const handleExpiryBlur = () => {
    if (!passportExpiryDate) {
      setExpiryError(null);
      return;
    }
    const reference = registration.departure_date
      ? new Date(registration.departure_date)
      : new Date();
    const minValidUntil = new Date(reference);
    minValidUntil.setMonth(minValidUntil.getMonth() + 6);

    if (new Date(passportExpiryDate) < minValidUntil) {
      setExpiryError(
        `Passeport non valide pour ce voyage : il doit rester valide au moins 6 mois après le ${reference.toLocaleDateString(
          "fr-FR"
        )}. Merci de vérifier la date ou de renouveler le passeport.`
      );
      setPassportExpiryDate("");
    } else {
      setExpiryError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/traveler`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phoneWhatsapp,
          gender,
          passportNumber: passportNumber || null,
          passportExpiryDate: passportExpiryDate || null,
          email: email || null,
        }),
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

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-sm font-semibold text-zinc-900">
        Informations du voyageur
        {!canEdit && (
          <span className="ml-2 text-xs font-normal text-zinc-400">
            (lecture seule pour votre rôle)
          </span>
        )}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Nom complet
          </label>
          <input
            required
            disabled={!canEdit}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Numéro WhatsApp
          </label>
          <input
            required
            disabled={!canEdit}
            value={phoneWhatsapp}
            onChange={(e) => setPhoneWhatsapp(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Genre</label>
          <select
            disabled={!canEdit}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Passeport
          </label>
          <input
            disabled={!canEdit}
            value={passportNumber}
            onChange={(e) => {
              setPassportNumber(e.target.value);
              setPassportCheck(null);
            }}
            onBlur={handlePassportBlur}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {passportCheck && (
            <p className={`mt-1 text-xs ${passportCheck.ok ? "text-emerald-700" : "text-red-600"}`}>
              {passportCheck.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Date d&apos;expiration du passeport
          </label>
          <input
            type="date"
            disabled={!canEdit}
            value={passportExpiryDate}
            onChange={(e) => {
              setPassportExpiryDate(e.target.value);
              setExpiryError(null);
            }}
            onBlur={handleExpiryBlur}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {expiryError && <p className="mt-1 text-xs text-red-600">{expiryError}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            disabled={!canEdit}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
