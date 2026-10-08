"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit la page serveur à intervalle régulier (inbox quasi temps réel),
// en pause quand l'onglet n'est pas visible.
export default function AutoRefresh({ seconds = 10 }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
