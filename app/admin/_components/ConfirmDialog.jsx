"use client";

import Modal from "./Modal";

// Remplace window.confirm() par une modale au style du reste de l'admin
// (Modal.jsx partagé) — voir useConfirm.jsx et CLAUDE.md.
export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
}) {
  return (
    <Modal title="Confirmation" onClose={onCancel}>
      <p className="text-sm text-zinc-700">{message}</p>
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
