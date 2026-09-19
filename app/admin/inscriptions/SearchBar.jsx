"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Filtre dès la première lettre tapée (pas besoin de valider) — la saisie
// est débattue de 300ms pour éviter une navigation à chaque frappe, sans
// pour autant attendre un mot complet. tripId/status restent inchangés
// dans l'URL, seul q est mis à jour.
export default function SearchBar({ initialQuery }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery || "");

  // Resynchronise si q change depuis l'extérieur (ex. le lien
  // "réinitialiser" de la page, qui navigue sans passer par ce champ).
  useEffect(() => {
    setValue(initialQuery || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.replace(`/admin/inscriptions?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Rechercher par nom ou groupe..."
      className="w-72 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
    />
  );
}
