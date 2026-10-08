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
    <Modal title="Confirmation" onClose={onCancel} size="sm">
      <p className="text-sm text-zinc-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
