"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { TEAMS, formatDateTime } from "../labels";

const ANCHORS = { depart: "date de départ", retour: "date de retour", inscription: "date d'inscription" };
const REG_STATUS = { inscrit: "Inscrit", confirme: "Confirmé", paye_partiel: "Payé partiel", paye_complet: "Payé complet" };
const VISA = { non_demande: "Non demandé", en_cours: "En cours", accorde: "Accordé", refuse: "Refusé" };
const STAGES = { prospect: "Prospect", qualifie: "Qualifié", inscrit: "Inscrit" };
const RUN_STATUS = {
  planifie: { label: "Planifié", bg: "#e8f0fd", fg: "#2b5cc4" },
  envoye: { label: "Envoyé", bg: "#e6f4ee", fg: "#0f6b4b" },
  annule: { label: "Annulé", bg: "#f1f1ee", fg: "#5a5a60" },
  ignore: { label: "Ignoré", bg: "#f1f1ee", fg: "#5a5a60" },
  echec: { label: "Échec", bg: "#fdecec", fg: "#c4373b" },
};
const CHANNEL = { template: "Template", texte: "Texte libre (gratuit)", interne: "Interne" };

const EMPTY = {
  name: "",
  description: "",
  family: "evenement",
  event_type: "inscription_creee",
  anchor: "depart",
  offset_days: -7,
  inactivity_hours: 24,
  audience: "inscrits",
  conditions: {},
  delay_minutes: 0,
  template_name: "",
  free_text_when_open: true,
  internal_action: "notifier_equipe",
  internal_team: "ventes",
  allowed_start: "09:00",
  allowed_end: "21:00",
  skip_friday_prayer: true,
  urgent: false,
  stop_conditions: [],
  max_per_target: 1,
};

async function api(body) {
  const res = await fetch("/api/admin/whatsapp/triggers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Action impossible");
  return data;
}

function describe(t, families, events) {
  if (t.family === "evenement") return `Événement : ${events[t.event_type] || t.event_type}`;
  if (t.family === "date_relative") {
    const d = Number(t.offset_days);
    return `${d < 0 ? `J${d}` : `J+${d}`} par rapport à la ${ANCHORS[t.anchor] || t.anchor}`;
  }
  if (t.family === "inactivite") return `Sans réponse depuis ${t.inactivity_hours} h`;
  return families[t.family] || t.family;
}

function Toggle({ value, onChange, labels }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(labels).map(([k, v]) => (
        <label key={k} className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" checked={(value || []).includes(k)} onChange={(e) => onChange(e.target.checked ? [...(value || []), k] : (value || []).filter((x) => x !== k))} />
          {v}
        </label>
      ))}
    </div>
  );
}

function Editor({ initial, templates, teams, families, events, stops, internalActions, onSaved, onClose }) {
  const [t, setT] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setT((x) => ({ ...x, ...patch }));
  const setCond = (patch) => setT((x) => ({ ...x, conditions: { ...x.conditions, ...patch } }));
  const selected = templates.find((x) => x.name === t.template_name);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api({ action: "save", trigger: { ...t, allowed_start: String(t.allowed_start).slice(0, 5), allowed_end: String(t.allowed_end).slice(0, 5) } });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Nom
          <input required value={t.name} onChange={(e) => set({ name: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="text-sm">
          Famille
          <select value={t.family} onChange={(e) => set({ family: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
            {Object.entries(families).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        {t.family === "evenement" && (
          <label className="text-sm">
            Événement
            <select value={t.event_type || ""} onChange={(e) => set({ event_type: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
              {Object.entries(events).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {t.family === "date_relative" && (
          <div className="flex items-end gap-2 text-sm">
            <label>
              Jours (−7 = J-7)
              <input type="number" value={t.offset_days ?? 0} onChange={(e) => set({ offset_days: Number(e.target.value) })} className="mt-1 w-24 rounded-md border px-3 py-2" />
            </label>
            <label className="flex-1">
              par rapport à
              <select value={t.anchor || "depart"} onChange={(e) => set({ anchor: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
                {Object.entries(ANCHORS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {t.family === "inactivite" && (
          <label className="text-sm">
            Sans réponse du client depuis (heures)
            <input type="number" min={1} value={t.inactivity_hours ?? 24} onChange={(e) => set({ inactivity_hours: Number(e.target.value) })} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        )}
        {t.family === "interne" && (
          <>
            <label className="text-sm">
              Action
              <select value={t.internal_action || "notifier_equipe"} onChange={(e) => set({ internal_action: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
                {Object.entries(internalActions).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Équipe notifiée
              <select value={t.internal_team || "direction"} onChange={(e) => set({ internal_team: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
                {[...new Set([...teams, "direction"])].map((k) => (
                  <option key={k} value={k}>{TEAMS[k] || k}</option>
                ))}
              </select>
            </label>
            {t.internal_action === "notifier_equipe" && (
              <label className="text-sm">
                Quand
                <select value={t.event_type || "prospect_qualifie"} onChange={(e) => set({ event_type: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
                  {Object.entries(events).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>

      {t.family !== "interne" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Template
            <select required value={t.template_name || ""} onChange={(e) => set({ template_name: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="">Choisir…</option>
              {templates.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                  {x.approved ? "" : " (non approuvé)"}
                </option>
              ))}
            </select>
            {selected && !selected.approved && <span className="mt-1 block text-xs text-amber-700">Non approuvé par Meta : seul l&apos;envoi en texte libre (fenêtre 24h ouverte) sera possible.</span>}
            {selected?.category === "MARKETING" && <span className="mt-1 block text-xs text-amber-700">Marketing : uniquement aux contacts consentants, 1 par semaine maximum.</span>}
          </label>
          <label className="text-sm">
            Délai après l&apos;événement (minutes)
            <input type="number" min={0} value={t.delay_minutes} onChange={(e) => set({ delay_minutes: Number(e.target.value) })} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
      )}

      {t.family !== "interne" && (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <div className="text-sm font-medium">Conditions</div>
          {t.family === "inactivite" ? (
            <div className="text-xs">
              Étapes du contact : <Toggle value={t.conditions.etapes} labels={STAGES} onChange={(v) => setCond({ etapes: v })} />
            </div>
          ) : (
            <>
              <div className="text-xs">
                Statuts d&apos;inscription (aucun = tous) : <Toggle value={t.conditions.statuts} labels={REG_STATUS} onChange={(v) => setCond({ statuts: v })} />
              </div>
              <div className="text-xs">
                Statut visa (aucun = tous) : <Toggle value={t.conditions.visa} labels={VISA} onChange={(v) => setCond({ visa: v })} />
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(t.conditions.solde_positif)} onChange={(e) => setCond({ solde_positif: e.target.checked })} />
                  Reste à payer &gt; 0
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(t.conditions.documents_incomplets)} onChange={(e) => setCond({ documents_incomplets: e.target.checked })} />
                  Passeport incomplet
                </label>
                <label className="inline-flex items-center gap-1">
                  Famille :
                  <select value={t.conditions.famille || ""} onChange={(e) => setCond({ famille: e.target.value || undefined })} className="rounded-md border px-1 py-0.5">
                    <option value="">Toutes</option>
                    <option value="omra_hajj">Omra & Hajj</option>
                    <option value="voyage_organise">Voyages organisés</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="text-xs">
            Arrêter si : <Toggle value={t.stop_conditions} labels={stops} onChange={(v) => set({ stop_conditions: v })} />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          Envoi à partir de
          <input type="time" value={String(t.allowed_start).slice(0, 5)} onChange={(e) => set({ allowed_start: e.target.value })} className="mt-1 w-full rounded-md border px-2 py-2" />
        </label>
        <label className="text-sm">
          jusqu&apos;à
          <input type="time" value={String(t.allowed_end).slice(0, 5)} onChange={(e) => set({ allowed_end: e.target.value })} className="mt-1 w-full rounded-md border px-2 py-2" />
        </label>
        <label className="text-sm">
          Envois max par personne
          <input type="number" min={1} max={10} value={t.max_per_target} onChange={(e) => set({ max_per_target: Number(e.target.value) })} className="mt-1 w-full rounded-md border px-2 py-2" />
        </label>
        <div className="space-y-1 pt-5 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={t.skip_friday_prayer} onChange={(e) => set({ skip_friday_prayer: e.target.checked })} />
            Pas le vendredi 12h-14h
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={t.urgent} onChange={(e) => set({ urgent: e.target.checked })} />
            Urgent (ignore les horaires)
          </label>
          {t.family !== "interne" && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={t.free_text_when_open} onChange={(e) => set({ free_text_when_open: e.target.checked })} />
              Texte libre si fenêtre 24h ouverte
            </label>
          )}
        </div>
      </div>
      <label className="block text-sm">
        Description
        <input value={t.description || ""} onChange={(e) => set({ description: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
      </label>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="gf-btn-primary">
          Enregistrer
        </button>
        <button type="button" className="gf-btn-outline" onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function TriggersManager({ initialTriggers, templates, teams, trips, families, events, stops, internalActions }) {
  const [triggers, setTriggers] = useState(initialTriggers);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [launch, setLaunch] = useState(null);
  const [runs, setRuns] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  async function reload() {
    const res = await fetch("/api/admin/whatsapp/triggers");
    setTriggers(await res.json());
  }
  async function act(body, success) {
    setMessage(null);
    try {
      const data = await api(body);
      await reload();
      if (success) setMessage({ ok: true, text: success(data) });
      return data;
    } catch (err) {
      setMessage({ ok: false, text: err.message });
      return null;
    }
  }
  async function showRuns(trigger) {
    const res = await fetch(`/api/admin/whatsapp/triggers?runs=${trigger ? trigger.id : "all"}`);
    setRuns({ title: trigger ? trigger.name : "Toutes les exécutions", rows: await res.json() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="gf-btn-primary" onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="add" size={16} />
          Nouveau déclencheur
        </button>
        <button type="button" className="gf-btn-outline" onClick={() => act({ action: "seed" }, (d) => `${d.created} déclencheur(s) ajouté(s), tous inactifs.`)}>
          Charger les 27 déclencheurs proposés
        </button>
        <button type="button" className="gf-btn-outline" onClick={() => showRuns(null)}>
          Historique des envois
        </button>
      </div>
      {message && <p className={`rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}

      <div className="gf-card overflow-hidden">
        {triggers.length === 0 ? (
          <div className="gf-empty">Aucun déclencheur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Actif</th>
                  <th>Déclencheur</th>
                  <th>Quand</th>
                  <th>Message</th>
                  <th>Envois 30 j</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <input type="checkbox" checked={t.is_active} aria-label="Actif" onChange={(e) => act({ action: "toggle", id: t.id, active: e.target.checked })} />
                    </td>
                    <td>
                      <div className="font-medium" translate="no">{t.name}</div>
                      {t.description && <div className="text-xs text-zinc-500" translate="no">{t.description}</div>}
                    </td>
                    <td className="text-sm">{describe(t, families, events)}</td>
                    <td className="text-sm">
                      {t.family === "interne" ? (
                        <>
                          {internalActions[t.internal_action]} → {TEAMS[t.internal_team] || t.internal_team}
                        </>
                      ) : (
                        <span className="font-mono text-xs" translate="no">{t.template_name}</span>
                      )}
                      {t.urgent && <span className="gf-chip ms-1">urgent</span>}
                    </td>
                    <td className="text-sm">
                      {Number(t.sent_30d)}
                      {Number(t.pending) > 0 && <span className="text-xs text-zinc-500">{` · ${t.pending} planifié(s)`}</span>}
                      {Number(t.failed_30d) > 0 && <span className="text-xs text-red-600"> · {t.failed_30d} échec(s)</span>}
                    </td>
                    <td className="gf-actions">
                      {t.family === "manuel" && (
                        <button type="button" className="gf-btn-soft" onClick={() => setLaunch({ trigger: t, tripId: "", text: "" })}>
                          Lancer
                        </button>
                      )}
                      <button type="button" className="gf-btn-icon" aria-label="Simuler" title="Simuler" onClick={async () => setSimulation({ trigger: t, ...(await act({ action: "simulate", id: t.id })) })}>
                        <Icon name="visibility" size={18} />
                      </button>
                      <button type="button" className="gf-btn-icon" aria-label="Historique" title="Historique" onClick={() => showRuns(t)}>
                        <Icon name="schedule" size={18} />
                      </button>
                      <button type="button" className="gf-btn-icon" aria-label="Modifier" onClick={() => setEditing({ ...EMPTY, ...t, allowed_start: String(t.allowed_start).slice(0, 5), allowed_end: String(t.allowed_end).slice(0, 5) })}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button
                        type="button"
                        className="gf-btn-icon gf-danger"
                        aria-label="Supprimer"
                        onClick={async () => {
                          if (await confirm("Supprimer ce déclencheur et son historique ?")) act({ action: "delete", id: t.id });
                        }}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? "Modifier le déclencheur" : "Nouveau déclencheur"} onClose={() => setEditing(null)} size="lg">
          <Editor
            initial={editing}
            templates={templates}
            teams={teams}
            families={families}
            events={events}
            stops={stops}
            internalActions={internalActions}
            onSaved={reload}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}

      {simulation && (
        <Modal title={`Simulation : ${simulation.trigger.name}`} onClose={() => setSimulation(null)}>
          <p className="mb-2 text-sm text-zinc-500">
            {simulation.mode === "aujourdhui" ? "Personnes qui recevraient ce message aujourd'hui (rien n'est envoyé) :" : "Envois actuellement planifiés :"}
          </p>
          {(simulation.targets || []).length === 0 ? (
            <p className="text-sm">Personne.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {simulation.targets.map((x, i) => (
                <li key={i} translate="no">
                  {x.name || "—"} {x.phone ? <span className="gf-phone" dir="ltr">{x.phone}</span> : x.scheduledAt ? `· ${formatDateTime(x.scheduledAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {launch && (
        <Modal title={`Lancer : ${launch.trigger.name}`} onClose={() => setLaunch(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = await act({ action: "launch", id: launch.trigger.id, tripId: launch.tripId, text: launch.text }, (d) => `${d.planned} envoi(s) planifié(s).`);
              if (data) setLaunch(null);
            }}
          >
            <label className="block text-sm">
              Voyage
              <select required value={launch.tripId} onChange={(e) => setLaunch((l) => ({ ...l, tripId: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="">Choisir…</option>
                {trips.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.title} — {String(tr.departure_date).slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Texte (variable « texte saisi au moment de l&apos;envoi »)
              <textarea value={launch.text} onChange={(e) => setLaunch((l) => ({ ...l, text: e.target.value }))} rows={3} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
            </label>
            <button type="submit" className="gf-btn-primary">
              Planifier l&apos;envoi à tous les inscrits
            </button>
          </form>
        </Modal>
      )}

      {runs && (
        <Modal title={runs.title} onClose={() => setRuns(null)} size="lg">
          {runs.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune exécution.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="gf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Destinataire</th>
                    <th>Déclencheur</th>
                    <th>Statut</th>
                    <th>Canal / résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.rows.map((r) => {
                    const st = RUN_STATUS[r.status] || RUN_STATUS.planifie;
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-xs">{formatDateTime(r.executed_at || r.scheduled_at)}</td>
                        <td className="text-sm" translate="no">{r.traveler_name || r.profile_name || (r.phone ? `+${r.phone}` : "—")}</td>
                        <td className="text-sm" translate="no">{r.trigger_name}</td>
                        <td>
                          <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                        </td>
                        <td className="text-xs">
                          {r.channel ? CHANNEL[r.channel] : ""}
                          {r.result && !String(r.result).startsWith("texte:") && <span translate="no"> {r.result}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
