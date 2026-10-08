"use client";

import { useRouter } from "next/navigation";
import Icon from "../../../_components/Icon";
import { useConfirm } from "../../../_components/useConfirm";

// Arrêt d'urgence (CP-05) : plus aucun message, destinataires restants annulés.
export default function CampaignStopButton({ id, name }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      <button
        type="button"
        className="gf-btn-outline"
        style={{ color: "var(--gf-danger)" }}
        onClick={async () => {
          if (!(await confirm(`Arrêt d'urgence de « ${name} » : plus aucun message ne sera envoyé. Confirmer ?`))) return;
          await fetch("/api/admin/whatsapp/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", id }) });
          router.refresh();
        }}
      >
        <Icon name="stop_circle" size={16} />
        Arrêt d&apos;urgence
      </button>
      {confirmDialog}
    </>
  );
}
