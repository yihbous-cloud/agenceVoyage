"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TravelerFields from "@/app/admin/inscriptions/new/TravelerFields";

const emptyMember = () => ({
  fullName: "",
  fullNameArabic: "",
  gender: "homme",
  dateOfBirth: "",
  nationalId: "",
  passportNumber: "",
  passportIssueDate: "",
  passportExpiryDate: "",
  phone: "",
  phoneWhatsapp: "",
  additionalPhoneNumbers: [],
  email: "",
  address: "",
});

// Ajouter d'autres voyageurs à ce groupe déjà existant — jusqu'ici, la
// seule façon était de créer l'inscription séparément puis de la faire
// "Rejoindre un groupe existant" depuis SA PROPRE fiche (§3quindecies).
// Une action de PAGE (pas par membre, contrairement à un essai précédent
// dans EditRegistrationForm.jsx) : tripId/groupId sont fixes, chaque
// voyageur ajouté crée une NOUVELLE inscription (POST séparé, même logique
// que le type "Groupe" de NewRegistrationForm.jsx) — rattachée d'emblée à
// ce groupe, pas une fusion de dossiers.
export default function AddGroupMemberForm({ tripId, groupId, departureDate }) {
  const router = useRouter();
  const [addingMembers, setAddingMembers] = useState(false);
  const [newMembers, setNewMembers] = useState([emptyMember()]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateMemberAt = (index, updated) =>
    setNewMembers((prev) => prev.map((t, i) => (i === index ? updated : t)));
  const handleAddField = () => setNewMembers((prev) => [...prev, emptyMember()]);
  const handleRemoveField = (index) =>
    setNewMembers((prev) => prev.filter((_, i) => i !== index));
  const handleCancel = () => {
    setAddingMembers(false);
    setNewMembers([emptyMember()]);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      for (const traveler of newMembers) {
        const res = await fetch("/api/admin/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, ...traveler, groupId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            `${traveler.fullName || "Voyageur"} : ${data.message || "Erreur lors de la création"}`
          );
        }
      }
      setAddingMembers(false);
      setNewMembers([emptyMember()]);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!addingMembers) {
    return (
      <button
        type="button"
        onClick={() => setAddingMembers(true)}
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        + Ajouter un voyageur au groupe
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Chaque voyageur ajouté crée une nouvelle inscription, rattachée d&apos;emblée
        à ce groupe.
      </p>
      {newMembers.map((traveler, index) => (
        <TravelerFields
          key={index}
          label={`Nouveau voyageur ${index + 1}`}
          traveler={traveler}
          onChange={(updated) => updateMemberAt(index, updated)}
          departureDate={departureDate}
          onRemove={newMembers.length > 1 ? () => handleRemoveField(index) : undefined}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAddField}
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Ajouter un voyageur
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Ajout..." : "Ajouter au groupe"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-zinc-500 hover:underline"
        >
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
