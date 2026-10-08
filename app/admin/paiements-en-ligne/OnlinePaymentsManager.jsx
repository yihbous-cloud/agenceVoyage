"use client";

import { useState } from "react";
import Icon from "../_components/Icon";
import { formatDateTime } from "../whatsapp/labels";

const FIELD_LABELS = {
  secretKey: "Clé secrète (sk_test_… / sk_live_…)",
  webhookSecret: "Secret du webhook (whsec_…)",
  clientId: "Identifiant client",
  clientSecret: "Secret client",
  currency: "Devise PayPal (EUR ou USD)",
  rateFromMad: "Taux de conversion 1 MAD → devise",
  storeKey: "Clé du magasin (storekey)",
  gatewayUrl: "URL de paiement CMI (vide = environnement de test)",
  instructions: "Instructions de virement (RIB, banque, bénéficiaire)",
};
const STATUS = {
  cree: { label: "Envoyé", bg: "#e8f0fd", fg: "#2b5cc4" },
  paye: { label: "Payé", bg: "#e6f4ee", fg: "#0f6b4b" },
  expire: { label: "Expiré", bg: "#f1f1ee", fg: "#5a5a60" },
  annule: { label: "Annulé", bg: "#f1f1ee", fg: "#5a5a60" },
  echec: { label: "À vérifier", bg: "#fdecec", fg: "#c4373b" },
};

async function post(body) {
  const res = await fetch("/api/admin/paiements-en-ligne", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Action impossible");
  return data;
}

function GatewayCard({ gateway, webhookBase, onSaved }) {
  const [active, setActive] = useState(gateway.isActive);
  const [publicConfig, setPublicConfig] = useState(gateway.publicConfig || {});
  const [secrets, setSecrets] = useState({});
  const [state, setState] = useState(null);
  async function save(e) {
    e.preventDefault();
    try {
      const data = await post({ action: "gateway", provider: gateway.provider, config: { isActive: active, publicConfig, secrets } });
      setSecrets({});
      onSaved(data.gateways);
      setState({ ok: true, text: "Enregistré." });
    } catch (err) {
      setState({ ok: false, text: err.message });
    }
  }
  return (
    <form onSubmit={save} className="gf-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="gf-card-title">{gateway.label}</h3>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>
      {gateway.provider !== "virement" && (
        <p className="text-xs text-zinc-500">
          Mode : <b>{gateway.mode === "live" ? "PRODUCTION (paiements réels)" : "test"}</b> · Non testé en conditions réelles : valider d&apos;abord en mode test.
        </p>
      )}
      {gateway.publicFields.map((f) =>
        f === "instructions" ? (
          <label key={f} className="block text-sm">
            {FIELD_LABELS[f] || f}
            <textarea value={publicConfig[f] || ""} onChange={(e) => setPublicConfig((c) => ({ ...c, [f]: e.target.value }))} rows={4} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        ) : (
          <label key={f} className="block text-sm">
            {FIELD_LABELS[f] || f}
            <input value={publicConfig[f] || ""} onChange={(e) => setPublicConfig((c) => ({ ...c, [f]: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2" dir="ltr" />
          </label>
        )
      )}
      {gateway.provider === "paypal" && (
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={publicConfig.live === true || publicConfig.live === "true"} onChange={(e) => setPublicConfig((c) => ({ ...c, live: e.target.checked }))} />
          Compte PayPal de production (sinon sandbox)
        </label>
      )}
      {gateway.secretFields.map((f) => (
        <label key={f} className="block text-sm">
          {FIELD_LABELS[f] || f}
          <input
            type="password"
            autoComplete="off"
            value={secrets[f] || ""}
            onChange={(e) => setSecrets((s) => ({ ...s, [f]: e.target.value }))}
            placeholder={gateway.secretsSet[f] ? "•••••••• (renseigné)" : "Non renseigné"}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
            dir="ltr"
          />
        </label>
      ))}
      {(gateway.provider === "stripe" || gateway.provider === "cmi") && (
        <p className="text-xs text-zinc-500">
          URL de notification à déclarer chez le prestataire : <span className="font-mono" translate="no" dir="ltr">{webhookBase}/{gateway.provider}</span>
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" className="gf-btn-primary">
          Enregistrer
        </button>
        {state && <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.text}</span>}
      </div>
    </form>
  );
}

export default function OnlinePaymentsManager({ initialGateways, initialLinks, registrations, canLinks, canGateways, webhookBase }) {
  const [gateways, setGateways] = useState(initialGateways);
  const [links, setLinks] = useState(initialLinks);
  const [form, setForm] = useState({ registrationId: "", provider: initialGateways.find((g) => g.isActive)?.provider || "", amount: "" });
  const [result, setResult] = useState(null);
  const active = gateways.filter((g) => g.isActive);

  async function reload() {
    const res = await fetch("/api/admin/paiements-en-ligne");
    const data = await res.json();
    setGateways(data.gateways);
    setLinks(data.links);
  }

  return (
    <div className="space-y-8">
      {canLinks && (
        <section className="space-y-4">
          <form
            className="gf-card grid gap-3 p-5 sm:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const link = await post({ action: "create", ...form });
                setResult({ ok: true, link });
                await reload();
              } catch (err) {
                setResult({ ok: false, text: err.message });
              }
            }}
          >
            <label className="text-sm sm:col-span-2">
              Dossier
              <select required value={form.registrationId} onChange={(e) => setForm((f) => ({ ...f, registrationId: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="">Choisir…</option>
                {registrations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} — {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Passerelle
              <select required value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="">Choisir…</option>
                {active.map((g) => (
                  <option key={g.provider} value={g.provider}>{g.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Montant (MAD, vide = reste à payer)
              <input type="number" min={1} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2" />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
              <button type="submit" disabled={active.length === 0} className="gf-btn-primary">
                <Icon name="link" size={16} />
                Créer le lien de paiement
              </button>
              {active.length === 0 && <span className="text-sm text-amber-700">Aucune passerelle active.</span>}
              {result && !result.ok && <span className="text-sm text-red-700">{result.text}</span>}
              {result?.ok && (
                <span className="text-sm text-emerald-700">
                  {`Lien créé (${result.link.amount} MAD) :`} <span className="font-mono" translate="no" dir="ltr">{result.link.url}</span>
                </span>
              )}
            </div>
          </form>

          <div className="gf-card overflow-hidden">
            {links.length === 0 ? (
              <div className="gf-empty">Aucun lien de paiement.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Montant</th>
                      <th>Passerelle</th>
                      <th>Référence</th>
                      <th>Statut</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l) => {
                      const st = STATUS[l.status] || STATUS.cree;
                      return (
                        <tr key={l.id}>
                          <td className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</td>
                          <td className="text-sm" translate="no">{l.full_name || "—"}</td>
                          <td className="text-sm">{Number(l.amount)} {l.currency}</td>
                          <td className="text-sm">
                            {l.provider} {l.mode === "test" && <span className="gf-chip">test</span>}
                          </td>
                          <td className="font-mono text-xs" translate="no">{l.reference}</td>
                          <td>
                            <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                          </td>
                          <td className="gf-actions">
                            {l.status === "cree" && (
                              <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={async () => { await post({ action: "cancel", id: l.id }); await reload(); }}>
                                Annuler
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {canGateways && (
        <section className="space-y-3">
          <h2 className="gf-card-title">
            <Icon name="settings" size={18} />
            Passerelles de paiement
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {gateways.map((g) => (
              <GatewayCard key={g.provider} gateway={g} webhookBase={webhookBase} onSaved={setGateways} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
