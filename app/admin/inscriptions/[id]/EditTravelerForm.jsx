"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PASSPORT_FORMAT, isPassportExpiryValid, getMinPassportValidUntil } from "@/lib/passportValidation";
import PassportScanInput from "../PassportScanInput";

export default function EditTravelerForm({ registration, canEdit }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(registration.full_name);
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(registration.phone_whatsapp);
  const [gender, setGender] = useState(registration.gender);
  const [passportNumber, setPassportNumber] = useState(registration.passport_number || "");
  const [passportExpiryDate, setPassportExpiryDate] = useState(
    registration.passport_expiry_date || ""
  );
  const [email, setEmail] = useState(registration.traveler_email || "");
  const [passportWarning, setPassportWarning] = useState(null);
  const [confirmedPassportNumber, setConfirmedPassportNumber] = useState(null);
  const [pendingConfirmValue, setPendingConfirmValue] = useState(null);
  const [passportLocked, setPassportLocked] = useState(Boolean(registration.info_confirmed));
  const [formLocked, setFormLocked] = useState(Boolean(registration.info_confirmed));
  const [expiryError, setExpiryError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const passportInputRef = useRef(null);

  const isPassportConfirmed =
    confirmedPassportNumber != null && confirmedPassportNumber === passportNumber.trim();
  const fieldsDisabled = !canEdit || formLocked;
  const passportDisabled = fieldsDisabled || passportLocked;

  const handlePassportBlur = () => {
    const value = passportNumber.trim();
    if (!value) {
      setPassportWarning(null);
      return;
    }
    if (!PASSPORT_FORMAT.test(value)) {
      setPassportWarning(
        "Le numéro de passeport semble incorrect (6 à 9 lettres/chiffres attendus). Merci de vérifier la saisie."
      );
      return;
    }
    setPassportWarning(null);
    if (value !== confirmedPassportNumber) {
      setPendingConfirmValue(value);
    }
  };

  const handleConfirmPassport = () => {
    setConfirmedPassportNumber(pendingConfirmValue);
    setPendingConfirmValue(null);
    setPassportLocked(true);
  };

  const handleCorrectPassport = () => {
    setPendingConfirmValue(null);
    passportInputRef.current?.focus();
  };

  const handleUnlockPassport = () => {
    setPassportLocked(false);
    setConfirmedPassportNumber(null);
  };

  const handleExpiryBlur = () => {
    if (!passportExpiryDate) {
      setExpiryError(null);
      return;
    }
    const { reference } = getMinPassportValidUntil(registration.departure_date);

    if (!isPassportExpiryValid(passportExpiryDate, registration.departure_date)) {
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
      setFormLocked(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockForm = () => {
    setFormLocked(false);
    setPassportLocked(false);
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="flex items-center justify-between text-sm font-semibold text-zinc-900">
        <span>
          Informations du voyageur
          {!canEdit && (
            <span className="ml-2 text-xs font-normal text-zinc-400">
              (lecture seule pour votre rôle)
            </span>
          )}
          {canEdit && formLocked && (
            <span className="ml-2 text-xs font-normal text-zinc-400">
              (verrouillé après enregistrement)
            </span>
          )}
        </span>
        {canEdit && formLocked && (
          <button
            type="button"
            onClick={handleUnlockForm}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Modifier
          </button>
        )}
      </h2>

      {!fieldsDisabled && (
        <PassportScanInput
          disabled={passportDisabled}
          onScan={(parsed) => {
            if (!parsed) return;
            if (parsed.fullName) setFullName(parsed.fullName);
            if (parsed.passportNumber) setPassportNumber(parsed.passportNumber);
            if (parsed.gender) setGender(parsed.gender);
            if (parsed.passportExpiryDate) setPassportExpiryDate(parsed.passportExpiryDate);
            setPassportWarning(null);
            setConfirmedPassportNumber(null);
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Nom complet
          </label>
          <input
            required
            disabled={fieldsDisabled}
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
            disabled={fieldsDisabled}
            value={phoneWhatsapp}
            onChange={(e) => setPhoneWhatsapp(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Genre</label>
          <select
            disabled={fieldsDisabled}
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
            ref={passportInputRef}
            disabled={passportDisabled}
            value={passportNumber}
            onChange={(e) => {
              setPassportNumber(e.target.value);
              setPassportWarning(null);
            }}
            onBlur={handlePassportBlur}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {passportWarning && <p className="mt-1 text-xs text-red-600">{passportWarning}</p>}
          {!passportWarning && (isPassportConfirmed || (passportDisabled && passportNumber)) && (
            <p className="mt-1 text-xs text-emerald-700">
              Vérification effectuée : le numéro de passeport est valide.
              {!fieldsDisabled && (
                <button
                  type="button"
                  onClick={handleUnlockPassport}
                  className="ml-2 font-medium text-zinc-500 hover:underline"
                >
                  Modifier
                </button>
              )}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Date d&apos;expiration du passeport
          </label>
          <input
            type="date"
            disabled={fieldsDisabled}
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
            disabled={fieldsDisabled}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canEdit && !formLocked && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>

    {pendingConfirmValue && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-zinc-900">
            Vérification du numéro de passeport
          </h3>
          <p className="mt-3 text-sm text-zinc-700">
            Vérifiez que le N° de Passeport est : <span className="font-bold">{pendingConfirmValue}</span> — Exact ?
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCorrectPassport}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Corriger
            </button>
            <button
              type="button"
              onClick={handleConfirmPassport}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
