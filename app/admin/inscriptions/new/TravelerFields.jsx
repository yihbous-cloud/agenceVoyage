"use client";

import { useRef, useState } from "react";
import { PASSPORT_FORMAT, isPassportExpiryValid, getMinPassportValidUntil } from "@/lib/passportValidation";

// Bloc de champs pour UN voyageur, réutilisable N fois (individuel = 1,
// binôme = 2, groupe = N) — porte sa propre vérification de passeport
// (format + dialogue de confirmation + expiration par rapport au voyage),
// même règle que EditTravelerForm.jsx (voir CLAUDE.md §3nonies).
export default function TravelerFields({ label, traveler, onChange, departureDate, onRemove }) {
  const [passportWarning, setPassportWarning] = useState(null);
  const [confirmedPassportNumber, setConfirmedPassportNumber] = useState(null);
  const [pendingConfirmValue, setPendingConfirmValue] = useState(null);
  const [passportLocked, setPassportLocked] = useState(false);
  const [expiryError, setExpiryError] = useState(null);
  const passportInputRef = useRef(null);

  const set = (key) => (e) => onChange({ ...traveler, [key]: e.target.value });

  const isPassportConfirmed =
    confirmedPassportNumber != null &&
    confirmedPassportNumber === traveler.passportNumber.trim();

  const handlePassportBlur = () => {
    const value = traveler.passportNumber.trim();
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
    if (!traveler.passportExpiryDate) {
      setExpiryError(null);
      return;
    }
    if (!isPassportExpiryValid(traveler.passportExpiryDate, departureDate)) {
      const { reference } = getMinPassportValidUntil(departureDate);
      setExpiryError(
        `Passeport non valide pour ce voyage : il doit rester valide au moins 6 mois après le ${reference.toLocaleDateString(
          "fr-FR"
        )}. Merci de vérifier la date ou de renouveler le passeport.`
      );
      onChange({ ...traveler, passportExpiryDate: "" });
    } else {
      setExpiryError(null);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Retirer
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom complet</label>
          <input
            required
            value={traveler.fullName}
            onChange={set("fullName")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Nom en arabe</label>
          <input
            value={traveler.fullNameArabic}
            onChange={set("fullNameArabic")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Genre</label>
          <select
            value={traveler.gender}
            onChange={set("gender")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Date de naissance</label>
          <input
            type="date"
            value={traveler.dateOfBirth}
            onChange={set("dateOfBirth")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">CIN</label>
          <input
            value={traveler.nationalId}
            onChange={set("nationalId")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">N° Passeport</label>
          <input
            ref={passportInputRef}
            disabled={passportLocked}
            value={traveler.passportNumber}
            onChange={(e) => {
              onChange({ ...traveler, passportNumber: e.target.value });
              setPassportWarning(null);
            }}
            onBlur={handlePassportBlur}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {passportWarning && <p className="mt-1 text-xs text-red-600">{passportWarning}</p>}
          {!passportWarning && (isPassportConfirmed || (passportLocked && traveler.passportNumber)) && (
            <p className="mt-1 text-xs text-emerald-700">
              Vérification effectuée : le numéro de passeport est valide.
              <button
                type="button"
                onClick={handleUnlockPassport}
                className="ml-2 font-medium text-zinc-500 hover:underline"
              >
                Modifier
              </button>
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Expiration passeport
          </label>
          <input
            type="date"
            value={traveler.passportExpiryDate}
            onChange={(e) => {
              onChange({ ...traveler, passportExpiryDate: e.target.value });
              setExpiryError(null);
            }}
            onBlur={handleExpiryBlur}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          {expiryError && <p className="mt-1 text-xs text-red-600">{expiryError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">WhatsApp</label>
          <input
            required
            value={traveler.phoneWhatsapp}
            onChange={set("phoneWhatsapp")}
            placeholder="+212 6XX XXX XXX"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            value={traveler.email}
            onChange={set("email")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Adresse</label>
          <input
            value={traveler.address}
            onChange={set("address")}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {pendingConfirmValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-zinc-900">
              Vérification du numéro de passeport
            </h3>
            <p className="mt-3 text-sm text-zinc-700">
              Vérifiez que le N° de Passeport est :{" "}
              <span className="font-bold">{pendingConfirmValue}</span> — Exact ?
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
    </div>
  );
}
