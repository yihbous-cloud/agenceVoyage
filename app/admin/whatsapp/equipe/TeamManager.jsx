"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import { TEAMS } from "../labels";

const DAYS = [
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [0, "Dimanche"],
];

const hhmm = (t) => String(t || "").slice(0, 5);
const key = () => `n${Math.random().toString(36).slice(2)}`;

async function post(body) {
  const res = await fetch("/api/admin/whatsapp/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Enregistrement impossible");
  return data;
}

function Feedback({ state }) {
  if (!state) return null;
  return <p className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{state.text}</p>;
}

function Hours({ schedule }) {
  const [rows, setRows] = useState(schedule.hours.map((h) => ({ _key: key(), weekday: Number(h.weekday), openTime: hhmm(h.open_time), closeTime: hhmm(h.close_time) })));
  const [exceptions, setExceptions] = useState(
    schedule.exceptions.map((e) => ({ _key: key(), startDate: e.start_date, endDate: e.end_date, label: e.label, closed: e.closed, openTime: hhmm(e.open_time), closeTime: hhmm(e.close_time) }))
  );
  const [state, setState] = useState(null);
  const update = (setter, k, field, value) => setter((list) => list.map((x) => (x._key === k ? { ...x, [field]: value } : x)));

  async function save() {
    try {
      await post({ action: "hours", hours: rows, exceptions });
      setState({ ok: true, text: "Horaires enregistrés." });
    } catch (err) {
      setState({ ok: false, text: err.message });
    }
  }

  return (
    <section className="gf-card space-y-4 p-6">
      <h2 className="gf-card-title">
        <Icon name="schedule" size={18} />
        Horaires d&apos;ouverture (heure du Maroc)
      </h2>
      <div className="space-y-2">
        {DAYS.map(([d, label]) => {
          const dayRows = rows.filter((r) => r.weekday === d);
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 font-medium">{label}</span>
              {dayRows.length === 0 && <span className="text-zinc-400">Fermé</span>}
              {dayRows.map((r) => (
                <span key={r._key} className="inline-flex items-center gap-1">
                  <input type="time" value={r.openTime} onChange={(e) => update(setRows, r._key, "openTime", e.target.value)} className="rounded-md border px-2 py-1" />
                  –
                  <input type="time" value={r.closeTime} onChange={(e) => update(setRows, r._key, "closeTime", e.target.value)} className="rounded-md border px-2 py-1" />
                  <button type="button" className="gf-btn-icon gf-danger" aria-label="Retirer" onClick={() => setRows((l) => l.filter((x) => x._key !== r._key))}>
                    <Icon name="close" size={16} />
                  </button>
                </span>
              ))}
              <button type="button" className="text-xs text-emerald-700 hover:underline" onClick={() => setRows((l) => [...l, { _key: key(), weekday: d, openTime: "09:00", closeTime: "18:00" }])}>
                + plage
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Exceptions (jours fériés, horaires de Ramadan)</h3>
        <div className="space-y-2">
          {exceptions.map((e) => (
            <div key={e._key} className="flex flex-wrap items-center gap-2 text-sm">
              <input value={e.label} onChange={(ev) => update(setExceptions, e._key, "label", ev.target.value)} placeholder="Libellé" className="w-40 rounded-md border px-2 py-1" />
              <input type="date" value={e.startDate} onChange={(ev) => update(setExceptions, e._key, "startDate", ev.target.value)} className="rounded-md border px-2 py-1" />
              →
              <input type="date" value={e.endDate} onChange={(ev) => update(setExceptions, e._key, "endDate", ev.target.value)} className="rounded-md border px-2 py-1" />
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={e.closed} onChange={(ev) => update(setExceptions, e._key, "closed", ev.target.checked)} />
                Fermé
              </label>
              {!e.closed && (
                <>
                  <input type="time" value={e.openTime} onChange={(ev) => update(setExceptions, e._key, "openTime", ev.target.value)} className="rounded-md border px-2 py-1" />
                  –
                  <input type="time" value={e.closeTime} onChange={(ev) => update(setExceptions, e._key, "closeTime", ev.target.value)} className="rounded-md border px-2 py-1" />
                </>
              )}
              <button type="button" className="gf-btn-icon gf-danger" aria-label="Retirer" onClick={() => setExceptions((l) => l.filter((x) => x._key !== e._key))}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="gf-btn-soft"
            onClick={() => setExceptions((l) => [...l, { _key: key(), label: "", startDate: "", endDate: "", closed: true, openTime: "10:00", closeTime: "16:00" }])}
          >
            <Icon name="add" size={16} />
            Ajouter une exception
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="gf-btn-primary" onClick={save}>
          Enregistrer les horaires
        </button>
        <Feedback state={state} />
      </div>
    </section>
  );
}

function SlaRules({ sla, teams }) {
  const [rules, setRules] = useState(sla);
  const [state, setState] = useState(null);
  const update = (id, field, value) => setRules((l) => l.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  async function save(r) {
    try {
      await post({ action: "sla", id: r.id, rule: { team: r.team, minutes: Number(r.minutes), priority: r.priority, aroundTheClock: r.around_the_clock } });
      setState({ ok: true, text: `« ${r.label} » enregistré.` });
    } catch (err) {
      setState({ ok: false, text: err.message });
    }
  }
  const teamOptions = [...new Set([...teams, "guide", "accompagnateur", "direction"])];
  return (
    <section className="gf-card overflow-hidden">
      <div className="gf-card-head gf-divided">
        <h2 className="gf-card-title">
          <Icon name="hourglass_top" size={18} />
          Délais de prise en charge par motif
        </h2>
      </div>
      <p className="px-5 pt-3 text-xs text-zinc-500">
        Délais comptés en horaires d&apos;ouverture (sauf « 24h/24 »). Une équipe sans membre actif retombe sur la direction. Au dépassement : alerte à l&apos;équipe, puis au responsable.
      </p>
      <div className="overflow-x-auto">
        <table className="gf-table">
          <thead>
            <tr>
              <th>Motif</th>
              <th>Équipe</th>
              <th>Délai (min)</th>
              <th>Priorité</th>
              <th>24h/24</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="text-sm">{r.label}</td>
                <td>
                  <select value={r.team} onChange={(e) => update(r.id, "team", e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                    {teamOptions.map((t) => (
                      <option key={t} value={t}>
                        {TEAMS[t] || t}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="number" min={1} value={r.minutes} onChange={(e) => update(r.id, "minutes", e.target.value)} className="w-24 rounded-md border px-2 py-1 text-sm" />
                </td>
                <td>
                  <select value={r.priority} onChange={(e) => update(r.id, "priority", e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={r.around_the_clock} onChange={(e) => update(r.id, "around_the_clock", e.target.checked)} />
                </td>
                <td className="gf-actions">
                  <button type="button" className="gf-btn-soft" onClick={() => save(r)}>
                    Enregistrer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4">
        <Feedback state={state} />
      </div>
    </section>
  );
}

function Escorts({ trips, staff }) {
  const [selection, setSelection] = useState(Object.fromEntries(trips.map((t) => [t.id, t.escorts.map((e) => e.staff_id)])));
  const [state, setState] = useState(null);
  async function save(tripId) {
    try {
      await post({ action: "escorts", tripId, staffIds: selection[tripId] || [] });
      setState({ ok: true, text: "Accompagnateurs enregistrés." });
    } catch (err) {
      setState({ ok: false, text: err.message });
    }
  }
  return (
    <section className="gf-card overflow-hidden">
      <div className="gf-card-head gf-divided">
        <h2 className="gf-card-title">
          <Icon name="luggage" size={18} />
          Accompagnateurs de permanence (urgences en voyage)
        </h2>
      </div>
      {trips.length === 0 ? (
        <div className="gf-empty">Aucun départ à venir.</div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {trips.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-[14rem] flex-1">
                <div className="font-medium" translate="no">{t.program_title}</div>
                <div className="text-xs text-zinc-500">
                  {String(t.departure_date).slice(0, 10)} → {String(t.return_date).slice(0, 10)}
                </div>
              </div>
              <select
                multiple
                value={(selection[t.id] || []).map(String)}
                onChange={(e) => setSelection((s) => ({ ...s, [t.id]: [...e.target.selectedOptions].map((o) => Number(o.value)) }))}
                className="min-w-[14rem] rounded-md border px-2 py-1 text-sm"
                size={Math.min(4, Math.max(2, staff.length))}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
              <button type="button" className="gf-btn-soft" onClick={() => save(t.id)}>
                Enregistrer
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="p-4">
        <Feedback state={state} />
      </div>
    </section>
  );
}

function QuickReplies({ initial }) {
  const [rows, setRows] = useState(initial.map((r) => ({ _key: `db${r.id}`, shortcut: r.shortcut, textFr: r.text_fr || "", textAr: r.text_ar || "" })));
  const [state, setState] = useState(null);
  const update = (k, field, value) => setRows((l) => l.map((x) => (x._key === k ? { ...x, [field]: value } : x)));
  async function save() {
    try {
      await post({ action: "quick-replies", replies: rows });
      setState({ ok: true, text: "Réponses rapides enregistrées." });
    } catch (err) {
      setState({ ok: false, text: err.message });
    }
  }
  return (
    <section className="gf-card space-y-3 p-6">
      <h2 className="gf-card-title">
        <Icon name="bolt" size={18} />
        Réponses rapides (RIB, adresse, documents, bagages...)
      </h2>
      {rows.map((r) => (
        <div key={r._key} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]">
          <input value={r.shortcut} onChange={(e) => update(r._key, "shortcut", e.target.value)} placeholder="raccourci" className="rounded-md border px-2 py-1 text-sm" dir="ltr" />
          <textarea value={r.textFr} onChange={(e) => update(r._key, "textFr", e.target.value)} rows={2} placeholder="Texte français" className="rounded-md border px-2 py-1 text-sm" dir="ltr" />
          <textarea value={r.textAr} onChange={(e) => update(r._key, "textAr", e.target.value)} rows={2} placeholder="النص بالعربية" className="rounded-md border px-2 py-1 text-sm" dir="rtl" />
          <button type="button" className="gf-btn-icon gf-danger" aria-label="Retirer" onClick={() => setRows((l) => l.filter((x) => x._key !== r._key))}>
            <Icon name="delete" size={18} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="gf-btn-soft" onClick={() => setRows((l) => [...l, { _key: key(), shortcut: "", textFr: "", textAr: "" }])}>
          <Icon name="add" size={16} />
          Ajouter
        </button>
        <button type="button" className="gf-btn-primary" onClick={save}>
          Enregistrer
        </button>
        <Feedback state={state} />
      </div>
    </section>
  );
}

export default function TeamManager({ initial }) {
  return (
    <div className="space-y-6">
      <Hours schedule={initial.schedule} />
      <SlaRules sla={initial.sla} teams={initial.teams} />
      <Escorts trips={initial.trips} staff={initial.staff} />
      <QuickReplies initial={initial.quickReplies} />
    </div>
  );
}
