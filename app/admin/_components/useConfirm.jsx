"use client";

import { useState, useCallback } from "react";
import ConfirmDialog from "./ConfirmDialog";

// Remplace window.confirm() (dialogue natif du navigateur, non stylable)
// par une modale cohérente avec le reste de l'admin. Usage identique à
// confirm() au point d'appel, juste asynchrone :
//   const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm("Supprimer ?"))) return;
//   ... puis rendre {confirmDialog} quelque part dans le JSX retourné.
export function useConfirm() {
  const [pending, setPending] = useState(null);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setPending({ message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    pending.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending.resolve(false);
    setPending(null);
  };

  const confirmDialog = pending ? (
    <ConfirmDialog message={pending.message} onConfirm={handleConfirm} onCancel={handleCancel} />
  ) : null;

  return [confirm, confirmDialog];
}
