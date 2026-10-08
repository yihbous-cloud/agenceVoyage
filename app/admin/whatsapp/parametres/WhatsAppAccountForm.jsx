"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../../_components/Icon";
import { useConfirm } from "../../_components/useConfirm";

// Formulaire du compte WhatsApp Business (Lot 0). Les secrets (jeton système,
// app secret) ne sont jamais renvoyés par le serveur : le champ reste vide,
// l'ancienne valeur est conservée tant qu'on n'en saisit pas une nouvelle.

const STATUS_OPTIONS = [
  { value: "test", label: "Test (numéro de test Meta)" },
  { value: "actif", label: "Actif (production)" },
  { value: "inactif", label: "Inactif" },
];

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1 flex gap-2">
        <input readOnly value={value || ""} dir="ltr" translate="no" className="w-full rounded-md border px-3 py-2 font-mono text-xs" />
        <button
          type="button"
          className="gf-btn-outline whitespace-nowrap"
          disabled={!value}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // presse-papiers indisponible (contexte non sécurisé) : sélection manuelle
            }
          }}
        >
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export default function WhatsAppAccountForm({ account, webhookUrl, encryptionOk }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [values, setValues] = useState({
    label: account?.label || "Numéro principal",
    wabaId: account?.waba_id || "",
    phoneNumberId: account?.phone_number_id || "",
    displayPhone: account?.display_phone || "",
    status: account?.status || "test",
    accessToken: "",
    appSecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setMessage(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Enregistrement impossible");
      setValues((v) => ({ ...v, accessToken: "", appSecret: "" }));
      setMessage({ ok: true, text: "Paramètres enregistrés." });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/account/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMessage(
        data.ok
          ? { ok: true, text: `Connexion réussie : ${data.info?.verified_name || ""} ${data.info?.display_phone_number || ""}`.trim() }
          : { ok: false, text: `Connexion impossible : ${data.message || "erreur inconnue"}` }
      );
      router.refresh();
    } finally {
      setTesting(false);
    }
  }

  // Copie locale des templates approuvés (envoi depuis l'inbox hors fenêtre 24h).
  async function handleSyncTemplates() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { ok: true, text: `${data.count} template(s) synchronisé(s), dont ${data.templates.length} approuvé(s).` }
          : { ok: false, text: data.message || "Synchronisation impossible" }
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleRegenerate() {
    if (!(await confirm("Générer un nouveau jeton de vérification ? Il faudra le recopier dans la configuration du webhook chez Meta."))) return;
    const res = await fetch("/api/admin/whatsapp/account/verify-token", { method: "POST" });
    if (res.ok) {
      setMessage({ ok: true, text: "Nouveau jeton généré." });
      router.refresh();
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="gf-card-title">
          <Icon name="key" size={18} />
          Compte WhatsApp Business
        </h2>

        {!encryptionOk && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La clé de chiffrement SECRETS_ENCRYPTION_KEY n&apos;est pas configurée sur le serveur : les jetons ne
            peuvent pas être enregistrés.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Libellé</label>
            <input value={values.label} onChange={set("label")} className="mt-1 w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Statut</label>
            <select value={values.status} onChange={set("status")} className="mt-1 w-full rounded-md border px-3 py-2">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Identifiant du numéro (Phone number ID)</label>
            <input
              required
              value={values.phoneNumberId}
              onChange={set("phoneNumberId")}
              dir="ltr"
              inputMode="numeric"
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Identifiant du compte WhatsApp Business (WABA ID)</label>
            <input value={values.wabaId} onChange={set("wabaId")} dir="ltr" className="mt-1 w-full rounded-md border px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium">Numéro affiché</label>
            <input
              value={values.displayPhone}
              onChange={set("displayPhone")}
              dir="ltr"
              placeholder="+212 6 00 00 00 00"
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div />
          <div>
            <label className="block text-sm font-medium">Jeton d&apos;accès système (permanent)</label>
            <input
              type="password"
              autoComplete="off"
              value={values.accessToken}
              onChange={set("accessToken")}
              placeholder={account?.access_token_masked || "Non renseigné"}
              dir="ltr"
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono"
            />
            <p className="mt-1 text-xs text-zinc-500">Laisser vide pour conserver la valeur actuelle.</p>
          </div>
          <div>
            <label className="block text-sm font-medium">Clé secrète de l&apos;application Meta (App secret)</label>
            <input
              type="password"
              autoComplete="off"
              value={values.appSecret}
              onChange={set("appSecret")}
              placeholder={account?.app_secret_masked || "Non renseigné"}
              dir="ltr"
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono"
            />
            <p className="mt-1 text-xs text-zinc-500">Sert à vérifier la signature des webhooks Meta.</p>
          </div>
        </div>

        {account?.secrets_readable === false && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Les secrets enregistrés ne peuvent plus être déchiffrés (clé maître modifiée) : ressaisissez le jeton et
            l&apos;app secret.
          </p>
        )}

        {message && (
          <p className={`rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="gf-btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {account && (
            <button type="button" onClick={handleTest} disabled={testing} className="gf-btn-outline">
              {testing ? "Test en cours..." : "Tester la connexion"}
            </button>
          )}
          {account && (
            <button type="button" onClick={handleSyncTemplates} disabled={testing} className="gf-btn-outline">
              Synchroniser les templates Meta
            </button>
          )}
        </div>

        <div className="space-y-4 border-t border-zinc-100 pt-5">
          <h3 className="gf-card-title">
            <Icon name="link" size={18} />
            Webhook à déclarer chez Meta
          </h3>
          <p className="text-sm text-zinc-500">
            Dans l&apos;application Meta (WhatsApp &gt; Configuration), renseignez cette URL de rappel et ce jeton de
            vérification, puis abonnez-vous au champ « messages ».
          </p>
          <CopyField label="URL de rappel" value={webhookUrl} />
          {account ? (
            <>
              <CopyField label="Jeton de vérification" value={account.verify_token} />
              <button type="button" onClick={handleRegenerate} className="gf-btn-soft">
                Générer un nouveau jeton
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Le jeton de vérification sera généré au premier enregistrement.</p>
          )}
        </div>
      </form>
      {confirmDialog}
    </>
  );
}
