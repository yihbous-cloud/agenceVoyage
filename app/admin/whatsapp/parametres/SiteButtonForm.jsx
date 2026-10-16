"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import { useAdminLocale } from "../../_components/AdminLocale";
import { DEFAULT_SITE_BUTTON_MESSAGES, whatsappUrl } from "@/lib/contactLinks";

// Bouton WhatsApp flottant du site public (migration 049) : activé ou non,
// numéro (vide = numéro WhatsApp de l'agence) et message pré-rempli par
// langue. « [SITE] » est ajouté automatiquement à la fin du message.
export default function SiteButtonForm({ initial }) {
  const { tr } = useAdminLocale();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const number = form.number.trim() || form.agencyWhatsapp;
  const previewFr = number ? whatsappUrl(number, form.messageFr.trim() || DEFAULT_SITE_BUTTON_MESSAGES.fr) : null;
  const previewAr = number ? whatsappUrl(number, form.messageAr.trim() || DEFAULT_SITE_BUTTON_MESSAGES.ar) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/site-button", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Enregistrement impossible");
      setForm(data);
      setMessage({ ok: true, text: "Bouton enregistré : le site est mis à jour." });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="gf-card space-y-4 p-6">
      <h2 className="gf-card-title">
        <Icon name="chat" size={18} />
        Bouton WhatsApp du site
      </h2>
      <p className="text-sm text-zinc-500">
        Bouton rond affiché en bas à droite de toutes les pages du site. Un clic ouvre WhatsApp avec le message ci-dessous.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Afficher le bouton sur le site
      </label>

      <label className="block text-sm">
        Numéro WhatsApp
        <input
          type="tel"
          dir="ltr"
          value={form.number}
          onChange={(e) => set({ number: e.target.value })}
          placeholder={form.agencyWhatsapp || "0661 00 00 00"}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          {form.agencyWhatsapp
            ? "Laisser vide pour utiliser le numéro WhatsApp des paramètres de l'agence."
            : "Aucun numéro WhatsApp dans les paramètres de l'agence : saisissez-en un, sinon le bouton n'apparaît pas."}
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          Message en arabe
          <textarea
            dir="rtl"
            rows={3}
            maxLength={500}
            value={form.messageAr}
            onChange={(e) => set({ messageAr: e.target.value })}
            placeholder={DEFAULT_SITE_BUTTON_MESSAGES.ar}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Message en français (aussi pour l&apos;anglais)
          <textarea
            dir="ltr"
            rows={3}
            maxLength={500}
            value={form.messageFr}
            onChange={(e) => set({ messageFr: e.target.value })}
            placeholder={DEFAULT_SITE_BUTTON_MESSAGES.fr}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        {tr("Message vide : le texte grisé est utilisé. Le code [SITE] est ajouté à la fin pour reconnaître les contacts venus du site.")}
      </p>

      {(previewAr || previewFr) && (
        <p className="flex flex-wrap gap-4 text-sm">
          {previewAr && (
            <a href={previewAr} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gf-accent-ink)" }}>
              Tester (arabe)
            </a>
          )}
          {previewFr && (
            <a href={previewFr} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gf-accent-ink)" }}>
              Tester (français)
            </a>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="gf-btn-primary">
          {busy ? "Enregistrement..." : "Enregistrer"}
        </button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
