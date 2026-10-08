"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../_components/Icon";
import { useConfirm } from "../../_components/useConfirm";
import { REASONS, formatDateTime } from "../labels";

const TOOL_LABELS = {
  chercher_programmes: "Chercher les programmes et départs",
  details_programme: "Détail d'un programme (prix, hôtels, FAQ)",
  creer_ou_maj_prospect: "Enregistrer la qualification du prospect",
  etat_dossier: "État du dossier d'un client inscrit",
  enregistrer_document: "Classer un document / reçu reçu",
  demander_humain: "Transférer à un conseiller",
  planifier_rappel: "Planifier un rappel téléphonique",
  envoyer_brochure: "Envoyer la brochure d'un programme",
  envoyer_localisation: "Envoyer l'adresse de l'agence",
  proposer_choix: "Proposer des choix cliquables (boutons)",
};

const MESSAGE_LABELS = {
  privacy: "Mention d'information (premier échange, loi 09-08)",
  transfer_in_hours: "Transfert — conseillers disponibles",
  transfer_out_of_hours: "Transfert — hors horaires ({{OUVERTURE}} = réouverture)",
  waiting_human: "Message reçu la nuit pendant un traitement humain",
  urgence: "Urgence en voyage",
  technical_wait: "Panne de l'IA (message d'attente)",
  stop_confirmation: "Confirmation de désinscription (STOP)",
  vocal_not_transcribed: "Vocal non transcrit",
};

const MODES = [
  ["ia", "IA active", "L'agent répond seul et transfère selon les règles."],
  ["copilote", "Copilote", "L'agent rédige, un conseiller valide avant envoi."],
  ["off", "Désactivée", "Tous les messages vont directement aux conseillers."],
];

const MODEL_SUGGESTIONS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"];

export default function IaSettingsForm({ settings, activeId, versions, allTools }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [form, setForm] = useState({
    mode: settings.mode,
    systemPrompt: settings.system_prompt,
    modelConversation: settings.model_conversation,
    modelSummary: settings.model_summary,
    effort: settings.effort,
    maxTokens: settings.max_tokens,
    historySize: settings.history_size,
    monthlyCostCapUsd: settings.monthly_cost_cap_usd ?? "",
    toolsEnabled: settings.tools_enabled,
    transferKeywords: settings.transfer_keywords.map((k, i) => ({ ...k, _key: `k${i}` })),
    messages: settings.messages,
    prices: JSON.stringify(settings.prices, null, 2),
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const isActive = settings.id === activeId;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function post(payload) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/whatsapp/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Enregistrement impossible");
      return data;
    } catch (err) {
      setMessage({ ok: false, text: err.message });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    let prices;
    try {
      prices = JSON.parse(form.prices);
    } catch {
      setMessage({ ok: false, text: "Tarifs : JSON invalide." });
      return;
    }
    const data = await post({
      action: "save",
      settings: {
        ...form,
        prices,
        transferKeywords: form.transferKeywords.map(({ keyword, reason }) => ({ keyword, reason })),
      },
    });
    if (data) {
      setMessage({ ok: true, text: `Version ${data.settings.version} enregistrée et activée.` });
      router.push("/admin/whatsapp/ia");
      router.refresh();
    }
  }

  async function activate(id, version) {
    if (!(await confirm(`Réactiver la version ${version} ? Elle remplacera immédiatement la version active.`))) return;
    const data = await post({ action: "activate", id });
    if (data) {
      router.push("/admin/whatsapp/ia");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={handleSave} className="gf-card space-y-6 p-6 lg:col-span-2">
        {!isActive && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {`Vous consultez la version ${settings.version} (inactive). Enregistrer créera une nouvelle version à partir de celle-ci.`}
          </p>
        )}

        <section>
          <h2 className="gf-card-title mb-3">Mode de fonctionnement</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map(([value, label, help]) => (
              <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${form.mode === value ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"}`}>
                <input type="radio" name="mode" value={value} checked={form.mode === value} onChange={set("mode")} className="me-2" />
                <span className="font-medium">{label}</span>
                <span className="mt-1 block text-xs text-zinc-500">{help}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="gf-card-title mb-2">Prompt système</h2>
          <p className="mb-2 text-xs text-zinc-500">
            <code translate="no">{"{{AGENCE}}"}</code> est remplacé par le nom de l&apos;agence. Prix, dates et places ne doivent jamais figurer ici : ils viennent des outils CRM.
          </p>
          <textarea value={form.systemPrompt} onChange={set("systemPrompt")} rows={18} className="w-full rounded-md border px-3 py-2 font-mono text-xs" dir="auto" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Modèle de conversation
            <input list="ia-models" value={form.modelConversation} onChange={set("modelConversation")} className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm" dir="ltr" />
          </label>
          <label className="text-sm">
            Modèle léger (résumés)
            <input list="ia-models" value={form.modelSummary} onChange={set("modelSummary")} className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm" dir="ltr" />
          </label>
          <datalist id="ia-models">
            {MODEL_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <label className="text-sm">
            Effort de réflexion
            <select value={form.effort} onChange={set("effort")} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="low">Faible (rapide, conseillé pour le chat)</option>
              <option value="medium">Moyen</option>
              <option value="high">Élevé (plus lent)</option>
            </select>
          </label>
          <label className="text-sm">
            Longueur maximale de réponse (jetons)
            <input type="number" min={1000} max={32000} value={form.maxTokens} onChange={set("maxTokens")} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm">
            Messages d&apos;historique envoyés à l&apos;IA
            <input type="number" min={2} max={60} value={form.historySize} onChange={set("historySize")} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm">
            Plafond de dépense mensuel ($)
            <input type="number" min={0} step="1" value={form.monthlyCostCapUsd} onChange={set("monthlyCostCapUsd")} placeholder="Aucun" className="mt-1 w-full rounded-md border px-3 py-2" />
            <span className="mt-1 block text-xs text-zinc-500">Au-delà, l&apos;agent passe en copilote et la direction est alertée.</span>
          </label>
        </section>

        <section>
          <h2 className="gf-card-title mb-2">Outils actifs</h2>
          <div className="grid gap-1 sm:grid-cols-2">
            {allTools.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.toolsEnabled.includes(t)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, toolsEnabled: e.target.checked ? [...f.toolsEnabled, t] : f.toolsEnabled.filter((x) => x !== t) }))
                  }
                />
                {TOOL_LABELS[t] || t}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="gf-card-title mb-2">Mots-clés de traitement immédiat</h2>
          <p className="mb-2 text-xs text-zinc-500">Détectés avant l&apos;IA, dans n&apos;importe quelle conversation (y compris la nuit).</p>
          <div className="space-y-2">
            {form.transferKeywords.map((k) => (
              <div key={k._key} className="flex gap-2">
                <input
                  value={k.keyword}
                  onChange={(e) => setForm((f) => ({ ...f, transferKeywords: f.transferKeywords.map((x) => (x._key === k._key ? { ...x, keyword: e.target.value } : x)) }))}
                  className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                  dir="auto"
                />
                <select
                  value={k.reason}
                  onChange={(e) => setForm((f) => ({ ...f, transferKeywords: f.transferKeywords.map((x) => (x._key === k._key ? { ...x, reason: e.target.value } : x)) }))}
                  className="rounded-md border px-2 py-1.5 text-sm"
                >
                  <option value="urgence">{REASONS.urgence}</option>
                </select>
                <button type="button" className="gf-btn-icon gf-danger" aria-label="Retirer" onClick={() => setForm((f) => ({ ...f, transferKeywords: f.transferKeywords.filter((x) => x._key !== k._key) }))}>
                  <Icon name="delete" size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="gf-btn-soft"
              onClick={() => setForm((f) => ({ ...f, transferKeywords: [...f.transferKeywords, { keyword: "", reason: "urgence", _key: `n${Date.now()}` }] }))}
            >
              <Icon name="add" size={16} />
              Ajouter un mot-clé
            </button>
          </div>
        </section>

        <section>
          <h2 className="gf-card-title mb-2">Messages automatiques</h2>
          <div className="space-y-4">
            {Object.keys(MESSAGE_LABELS).map((key) => (
              <div key={key}>
                <div className="mb-1 text-sm font-medium">{MESSAGE_LABELS[key]}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["fr", "ar"].map((lang) => (
                    <textarea
                      key={lang}
                      rows={2}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                      value={form.messages[key]?.[lang] || ""}
                      onChange={(e) => setForm((f) => ({ ...f, messages: { ...f.messages, [key]: { ...f.messages[key], [lang]: e.target.value } } }))}
                      placeholder={lang === "fr" ? "Français" : "العربية"}
                      className="rounded-md border px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="gf-card-title mb-2">Tarifs utilisés pour le calcul des coûts ($ par million de jetons)</h2>
          <textarea value={form.prices} onChange={set("prices")} rows={8} className="w-full rounded-md border px-3 py-2 font-mono text-xs" dir="ltr" />
        </section>

        <div className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
          <label className="flex-1 text-sm">
            Note de version
            <input value={form.note} onChange={set("note")} placeholder="Ce qui change dans cette version" className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <button type="submit" disabled={saving} className="gf-btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer une nouvelle version"}
          </button>
        </div>
        {message && (
          <p className={`rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
        )}
      </form>

      <aside className="gf-card h-fit p-4">
        <h2 className="gf-card-title mb-3">
          <Icon name="schedule" size={18} />
          Versions
        </h2>
        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="rounded-md border border-zinc-100 p-2">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/admin/whatsapp/ia?version=${v.id}`} className="font-medium hover:underline">
                  Version {v.version}
                </Link>
                {v.is_active ? (
                  <span className="gf-pill" style={{ background: "#e6f4ee", color: "#0f6b4b" }}>Active</span>
                ) : (
                  <button type="button" className="text-xs text-emerald-700 hover:underline" disabled={saving} onClick={() => activate(v.id, v.version)}>
                    Réactiver
                  </button>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {formatDateTime(v.created_at, { year: "numeric" })}
                {v.created_by ? <> · <span translate="no">{v.created_by}</span></> : ""} · {v.mode}
              </div>
              {v.note && <div className="text-xs" translate="no">{v.note}</div>}
            </li>
          ))}
        </ul>
      </aside>
      {confirmDialog}
    </div>
  );
}
