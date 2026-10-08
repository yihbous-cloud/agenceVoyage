"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";

// Export CSV et import CSV (consentement obligatoire pour chaque contact).
export default function ContactsToolbar({ exportHref }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <a href={exportHref} className="gf-btn-outline">
        <Icon name="download" size={16} />
        Exporter (CSV)
      </a>
      <button type="button" className="gf-btn-primary" onClick={() => setOpen(true)}>
        <Icon name="upload" size={16} />
        Importer
      </button>
      {open && (
        <Modal
          title="Importer des contacts (CSV)"
          size="lg"
          onClose={() => {
            setOpen(false);
            setResult(null);
          }}
        >
          <div className="space-y-3 text-sm">
            <p>
              Colonnes reconnues : <b>téléphone</b> (obligatoire), nom, langue (fr, ar, darija_latin...), source, <b>consentement</b> (obligatoire : oui / non), texte du consentement.
              Séparateur « ; » ou « , ».
            </p>
            <p className="text-xs text-zinc-500">
              Seuls les contacts marqués « oui » recevront des messages marketing ; la preuve du consentement (texte, date, auteur de l&apos;import) est conservée.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setCsv(await file.text());
              }}
            />
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className="block w-full rounded-md border px-3 py-2 font-mono text-xs" placeholder={"telephone;nom;consentement;texte du consentement\n0661000000;Fatima;oui;Formulaire salon 2026"} dir="ltr" />
            <button
              type="button"
              className="gf-btn-primary"
              disabled={busy || !csv.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const res = await fetch("/api/admin/whatsapp/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.message || "Import impossible");
                  setResult(data);
                  router.refresh();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Importer
            </button>
            {error && <p className="text-red-700">{error}</p>}
            {result && (
              <div className="rounded-lg border p-3">
                <p>{`${result.created} contact(s) créé(s), ${result.updated} mis à jour, ${result.optedIn} consentement(s) marketing enregistré(s).`}</p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-auto text-xs text-red-700">
                    {result.errors.map((e) => (
                      <li key={e.line}>{`Ligne ${e.line} : ${e.message}`}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
