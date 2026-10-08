"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../../_components/Icon";
import { useConfirm } from "../../../_components/useConfirm";
import { STAGES } from "../../labels";

const LANGUAGES = { darija_latin: "Darija (latin)", darija_arabe: "Darija (arabe)", ar: "Arabe", fr: "Français", en: "Anglais" };

// Profil du contact (§8.5) : étape, conseiller, langue, consentement
// (historisé), blocage ; données personnelles : export et suppression.
export default function ContactEditor({ contact, staff, canEdit, canData }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [form, setForm] = useState({
    profileName: contact.profile_name || "",
    stage: contact.stage,
    advisorStaffId: contact.advisor_staff_id || "",
    language: contact.language || "",
    marketingOptIn: Boolean(contact.marketing_opt_in),
    blocked: Boolean(contact.blocked),
    consentText: "",
  });
  const [message, setMessage] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const consentChanged = form.marketingOptIn !== Boolean(contact.marketing_opt_in);

  async function save(e) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, advisorStaffId: form.advisorStaffId ? Number(form.advisorStaffId) : null, language: form.language || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage({ ok: false, text: data.message || "Enregistrement impossible" });
    setMessage({ ok: true, text: "Enregistré." });
    router.refresh();
  }

  return (
    <form className="gf-card space-y-3 p-5 text-sm" onSubmit={save}>
      <div className="gf-card-title">
        <Icon name="person" />
        Profil
      </div>
      <fieldset disabled={!canEdit} className="space-y-3">
        <label className="block">
          Nom
          <input value={form.profileName} onChange={(e) => set({ profileName: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" dir="auto" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Étape
            <select value={form.stage} onChange={(e) => set({ stage: e.target.value })} className="mt-1 block w-full rounded-md border px-2 py-2">
              {Object.entries(STAGES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Langue préférée
            <select value={form.language} onChange={(e) => set({ language: e.target.value })} className="mt-1 block w-full rounded-md border px-2 py-2">
              <option value="">—</option>
              {Object.entries(LANGUAGES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          Conseiller attitré
          <select value={form.advisorStaffId} onChange={(e) => set({ advisorStaffId: e.target.value })} className="mt-1 block w-full rounded-md border px-2 py-2">
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.marketingOptIn} onChange={(e) => set({ marketingOptIn: e.target.checked })} />
          Consentement aux messages marketing
        </label>
        {consentChanged && form.marketingOptIn && (
          <label className="block">
            Preuve du consentement (où et comment il a été donné)
            <input required value={form.consentText} onChange={(e) => set({ consentText: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" placeholder="Accord oral en agence le 08/10/2026" />
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.blocked} onChange={(e) => set({ blocked: e.target.checked })} />
          Bloquer ce numéro (abus) : plus aucune réponse automatique ni envoi
        </label>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="gf-btn-primary">
              Enregistrer
            </button>
            {contact.marketing_opt_in ? (
              <button type="button" className="gf-btn-outline" onClick={() => set({ marketingOptIn: false })}>
                Retirer du marketing
              </button>
            ) : null}
          </div>
        )}
      </fieldset>
      {message && <p className={message.ok ? "text-emerald-700" : "text-red-700"}>{message.text}</p>}

      {canData && (
        <div className="space-y-2 border-t pt-3">
          <p className="font-medium">Données personnelles (loi 09-08)</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/whatsapp/contacts/${contact.id}?format=export`} className="gf-btn-outline">
              <Icon name="download" size={16} />
              Exporter les données
            </a>
            <button
              type="button"
              className="gf-btn-outline"
              style={{ color: "var(--gf-danger)" }}
              onClick={async () => {
                if (!(await confirm("Supprimer définitivement les conversations, messages, médias et consentements de ce contact ? Le dossier de voyage du CRM n'est pas touché. Action irréversible."))) return;
                const res = await fetch(`/api/admin/whatsapp/contacts/${contact.id}`, { method: "DELETE" });
                if (res.ok) router.push("/admin/whatsapp/contacts");
                else setMessage({ ok: false, text: "Suppression impossible" });
              }}
            >
              <Icon name="delete" size={16} />
              Supprimer les données WhatsApp
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </form>
  );
}
