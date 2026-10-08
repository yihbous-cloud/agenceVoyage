"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";

export default function LinksManager({ initialLinks }) {
  const [links, setLinks] = useState(initialLinks);
  const [form, setForm] = useState({ code: "", label: "", prefilledMessage: "Salam, je souhaite des informations sur vos voyages." });
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(null);

  async function post(body) {
    setMessage(null);
    const res = await fetch("/api/admin/whatsapp/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: data.message || "Action impossible" });
      return false;
    }
    setLinks(data);
    return true;
  }

  return (
    <div className="space-y-6">
      <form
        className="gf-card grid gap-3 p-5 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await post({ link: form })) {
            setForm((f) => ({ ...f, code: "", label: "" }));
            setMessage({ ok: true, text: "Lien créé." });
          }
        }}
      >
        <label className="text-sm">
          Code source
          <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="FLYER-RAMADAN" className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm" dir="ltr" />
        </label>
        <label className="text-sm sm:col-span-2">
          Libellé
          <input required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Flyer Omra Ramadan 2027" className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-3">
          Message pré-rempli (le code est ajouté automatiquement à la fin)
          <textarea required value={form.prefilledMessage} onChange={(e) => setForm((f) => ({ ...f, prefilledMessage: e.target.value }))} rows={2} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
        </label>
        <div className="flex items-center gap-3 sm:col-span-3">
          <button type="submit" className="gf-btn-primary">
            <Icon name="add" size={16} />
            Créer le lien
          </button>
          {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
        </div>
      </form>

      <div className="gf-card overflow-hidden">
        {links.length === 0 ? (
          <div className="gf-empty">Aucun lien.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Lien</th>
                  <th>Contacts</th>
                  <th>Qualifiés</th>
                  <th>Inscrits</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className={l.is_active ? "" : "opacity-60"}>
                    <td>
                      <div className="font-mono text-sm" translate="no">{l.code}</div>
                      <div className="text-xs text-zinc-500" translate="no">{l.label}</div>
                    </td>
                    <td className="max-w-xs">
                      {l.url ? (
                        <button
                          type="button"
                          className="truncate text-start text-xs text-emerald-700 hover:underline"
                          translate="no"
                          dir="ltr"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(l.url);
                              setCopied(l.id);
                              setTimeout(() => setCopied(null), 1500);
                            } catch {
                              // presse-papiers indisponible
                            }
                          }}
                        >
                          {copied === l.id ? "Copié" : l.url}
                        </button>
                      ) : (
                        <span className="text-xs text-amber-700">Numéro WhatsApp de l&apos;agence non renseigné</span>
                      )}
                    </td>
                    <td className="text-sm">{Number(l.contacts)}</td>
                    <td className="text-sm">{Number(l.qualified)}</td>
                    <td className="text-sm">{Number(l.registered)}</td>
                    <td className="gf-actions">
                      {l.url && (
                        <>
                          <a href={`/api/admin/whatsapp/links/${l.id}/qr?format=png`} className="gf-btn-soft">
                            QR PNG
                          </a>
                          <a href={`/api/admin/whatsapp/links/${l.id}/qr?format=pdf`} className="gf-btn-soft ms-1">
                            PDF
                          </a>
                        </>
                      )}
                      <button type="button" className="ms-2 text-xs text-zinc-500 hover:underline" onClick={() => post({ action: "toggle", id: l.id, active: !l.is_active })}>
                        {l.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
