"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PASSPORT_FORMAT, isPassportExpiryValid, getMinPassportValidUntil } from "@/lib/passportValidation";
import PassportScanInput from "../PassportScanInput";

export default function EditTravelerForm({
  registration,
  canEdit,
  initialMode = "view",
  initialPhoneNumbers = [],
  onSuccess,
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(registration.full_name);
  const [fullNameArabic, setFullNameArabic] = useState(registration.full_name_arabic || "");
  const [dateOfBirth, setDateOfBirth] = useState(registration.date_of_birth || "");
  const [nationalId, setNationalId] = useState(registration.national_id || "");
  const [phone, setPhone] = useState(registration.phone || "");
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(registration.phone_whatsapp);
  const [additionalPhoneNumbers, setAdditionalPhoneNumbers] = useState(
    initialPhoneNumbers.map((p) => p.phone_number)
  );
  const [gender, setGender] = useState(registration.gender);
  const [passportNumber, setPassportNumber] = useState(registration.passport_number || "");
  const [passportIssueDate, setPassportIssueDate] = useState(
    registration.passport_issue_date || ""
  );
  const [passportExpiryDate, setPassportExpiryDate] = useState(
    registration.passport_expiry_date || ""
  );
  const [email, setEmail] = useState(registration.traveler_email || "");
  const [address, setAddress] = useState(registration.address || "");
  const [passportWarning, setPassportWarning] = useState(null);
  const [confirmedPassportNumber, setConfirmedPassportNumber] = useState(null);
  const [pendingConfirmValue, setPendingConfirmValue] = useState(null);
  // "Afficher" (mode par défaut) ouvre la fiche verrouillée — tous les
  // champs déjà remplis en lecture seule, comme EditRegistrationForm.jsx ;
  // "Modifier" (?mode=edit, voir page.js), ou le lien "Modifier" local,
  // déverrouille. Ne dépend plus de registration.info_confirmed : un
  // voyageur rempli à la création mais jamais explicitement "confirmé" doit
  // quand même s'afficher verrouillé via "Afficher".
  const [passportLocked, setPassportLocked] = useState(initialMode !== "edit");
  const [formLocked, setFormLocked] = useState(initialMode !== "edit");
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

  const updateAdditionalPhoneAt = (index, value) => {
    setAdditionalPhoneNumbers((prev) => prev.map((p, i) => (i === index ? value : p)));
  };
  const addAdditionalPhone = () => setAdditionalPhoneNumbers((prev) => [...prev, ""]);
  const removeAdditionalPhoneAt = (index) =>
    setAdditionalPhoneNumbers((prev) => prev.filter((_, i) => i !== index));

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
          fullNameArabic: fullNameArabic || null,
          dateOfBirth: dateOfBirth || null,
          nationalId: nationalId || null,
          phone: phone || null,
          phoneWhatsapp,
          additionalPhoneNumbers,
          gender,
          passportNumber: passportNumber || null,
          passportIssueDate: passportIssueDate || null,
          passportExpiryDate: passportExpiryDate || null,
          email: email || null,
          address: address || null,
        }),
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

  const handleUnlockForm = () => {
    setFormLocked(false);
    setPassportLocked(false);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {!canEdit && "Lecture seule pour votre rôle"}
          {canEdit && formLocked && "Verrouillé après enregistrement"}
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
      </div>

      {!fieldsDisabled && (
        <PassportScanInput
          disabled={passportDisabled}
          onScan={(parsed) => {
            if (!parsed) return;
            if (parsed.fullName) setFullName(parsed.fullName);
            if (parsed.passportNumber) setPassportNumber(parsed.passportNumber);
            if (parsed.gender) setGender(parsed.gender);
            if (parsed.dateOfBirth) setDateOfBirth(parsed.dateOfBirth);
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
            Nom en arabe
          </label>
          <input
            disabled={fieldsDisabled}
            value={fullNameArabic}
            onChange={(e) => setFullNameArabic(e.target.value)}
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
            Date de naissance
          </label>
          <input
            type="date"
            disabled={fieldsDisabled}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">CIN</label>
          <input
            disabled={fieldsDisabled}
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            N° Passeport
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
                  className="ms-2 font-medium text-zinc-500 hover:underline"
                >
                  Modifier
                </button>
              )}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Date de délivrance
          </label>
          <input
            type="date"
            disabled={fieldsDisabled}
            max={new Date().toISOString().slice(0, 10)}
            value={passportIssueDate}
            onChange={(e) => setPassportIssueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Date d&apos;expiration
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
        <div>
          <label className="block text-sm font-medium text-zinc-700">N° Tél</label>
          <input
            disabled={fieldsDisabled}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            N° WhatsApp
          </label>
          <input
            required
            disabled={fieldsDisabled}
            value={phoneWhatsapp}
            onChange={(e) => setPhoneWhatsapp(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-700">
            Autres numéros
          </label>
          <div className="mt-1 space-y-2">
            {additionalPhoneNumbers.map((number, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  disabled={fieldsDisabled}
                  value={number}
                  onChange={(e) => updateAdditionalPhoneAt(index, e.target.value)}
                  placeholder="ex. contact d'urgence"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                />
                {!fieldsDisabled && (
                  <button
                    type="button"
                    onClick={() => removeAdditionalPhoneAt(index)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
            {!fieldsDisabled && (
              <button
                type="button"
                onClick={addAdditionalPhone}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                + Ajouter un numéro
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Email (optionnel)</label>
          <input
            type="email"
            disabled={fieldsDisabled}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Adresse</label>
          <input
            disabled={fieldsDisabled}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
