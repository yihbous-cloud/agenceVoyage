"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { formatDateTime, REASONS } from "../labels";

// Charge un JSON et le passe à `set` ; retourne la fonction d'annulation de l'effet.
function fetchJson(url, set) {
  let alive = true;
  fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (alive && data) set(data);
    })
    .catch(() => {});
  return () => {
    alive = false;
  };
}

const OUTCOMES = { reponse: "Réponse", transfert: "Transfert", echec: "Échec", brouillon: "Brouillon (copilote)" };

function AuditLogTab({ staff, defaultFrom, today }) {
  const [filters, setFilters] = useState({ from: defaultFrom, to: today, staff: "", action: "" });
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const qs = new URLSearchParams(Object.entries({ type: "audit", ...filters }).filter(([, v]) => v)).toString();
  useEffect(() => fetchJson(`/api/admin/whatsapp/journal?${qs}`, setData), [qs]);

  return (
    <div className="space-y-3">
      <div className="gf-card flex flex-wrap items-end gap-2 p-4 text-sm">
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="rounded-md border px-2 py-1" />
        <span>→</span>
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="rounded-md border px-2 py-1" />
        <select value={filters.staff} onChange={(e) => setFilters((f) => ({ ...f, staff: e.target.value }))} className="rounded-md border px-2 py-1">
          <option value="">Tous les utilisateurs</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="rounded-md border px-2 py-1">
          <option value="">Toutes les actions</option>
          {(data?.actions || []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <a href={`/api/admin/whatsapp/journal?${qs}&format=csv`} className="gf-btn-outline ms-auto">
          <Icon name="download" size={16} />
          Exporter (CSV)
        </a>
      </div>
      <div className="gf-card overflow-hidden">
        {!data ? (
          <div className="gf-empty">Chargement...</div>
        ) : data.rows.length === 0 ? (
          <div className="gf-empty">Aucune action sur la période.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Objet</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td translate="no">{r.staff_name || "Système"}</td>
                  <td className="font-mono text-xs" translate="no">{r.action}</td>
                  <td className="text-xs" translate="no">{`${r.object_type}${r.object_id ? ` #${r.object_id}` : ""}`}</td>
                  <td className="gf-actions">
                    {(r.before_json || r.after_json) && (
                      <button type="button" className="gf-btn-outline" onClick={() => setDetail(r)}>
                        Avant / après
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <p className="text-xs text-zinc-500">{`${data.total} action(s) — 100 affichées au maximum, l'export contient tout.`}</p>}
      {detail && (
        <Modal title={detail.action} onClose={() => setDetail(null)} size="lg">
          <div className="grid gap-3 text-xs sm:grid-cols-2" dir="ltr">
            <div>
              <p className="mb-1 font-medium">Avant</p>
              <pre className="max-h-96 overflow-auto rounded bg-zinc-50 p-2">{JSON.stringify(detail.before_json, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 font-medium">Après</p>
              <pre className="max-h-96 overflow-auto rounded bg-zinc-50 p-2">{JSON.stringify(detail.after_json, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IaLogsTab({ defaultFrom, today }) {
  const [filters, setFilters] = useState({ from: defaultFrom, to: today, outcome: "", evaluation: "" });
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const qs = new URLSearchParams(Object.entries({ type: "ia", ...filters }).filter(([, v]) => v)).toString();
  useEffect(() => fetchJson(`/api/admin/whatsapp/journal?${qs}`, setData), [qs]);

  return (
    <div className="space-y-3">
      <div className="gf-card flex flex-wrap items-end gap-2 p-4 text-sm">
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="rounded-md border px-2 py-1" />
        <span>→</span>
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="rounded-md border px-2 py-1" />
        <select value={filters.outcome} onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value }))} className="rounded-md border px-2 py-1">
          <option value="">Toutes les issues</option>
          {(data?.outcomes || []).map((o) => (
            <option key={o} value={o}>
              {OUTCOMES[o] || o}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.evaluation === "a_corriger"} onChange={(e) => setFilters((f) => ({ ...f, evaluation: e.target.checked ? "a_corriger" : "" }))} />
          Réponses à corriger
        </label>
        <a href={`/api/admin/whatsapp/journal?${qs}&format=csv`} className="gf-btn-outline ms-auto">
          <Icon name="download" size={16} />
          Exporter (CSV)
        </a>
      </div>
      {data && <p className="text-sm text-zinc-600">{`${data.total} exécution(s) de l'agent — coût ${data.cost.toFixed(4)} $`}</p>}
      <div className="gf-card overflow-hidden">
        {!data ? (
          <div className="gf-empty">Chargement...</div>
        ) : data.rows.length === 0 ? (
          <div className="gf-empty">Aucun journal IA sur la période.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Conversation</th>
                <th>Issue</th>
                <th>Outils</th>
                <th className="gf-num">Jetons</th>
                <th className="gf-num">Durée</th>
                <th className="gf-num">Coût</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>{r.conversation_id ? <Link href={`/admin/whatsapp/conversations/${r.conversation_id}`}>{`#${r.conversation_id}`}</Link> : r.context}</td>
                  <td>
                    {OUTCOMES[r.outcome] || r.outcome}
                    {r.evaluation === "a_corriger" && <span className="gf-chip ms-1" style={{ color: "var(--gf-danger)" }}>à corriger</span>}
                  </td>
                  <td className="text-xs" translate="no">{Array.isArray(r.tools) ? r.tools.map((t) => t.name).join(", ") : ""}</td>
                  <td className="gf-num">{`${r.input_tokens}/${r.output_tokens}`}</td>
                  <td className="gf-num">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)} s` : "—"}</td>
                  <td className="gf-num">{`${Number(r.cost_usd).toFixed(4)} $`}</td>
                  <td className="gf-actions">
                    <button type="button" className="gf-btn-outline" onClick={() => setDetail(r)}>
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {detail && (
        <Modal title={`Journal IA #${detail.id}`} onClose={() => setDetail(null)} size="lg">
          <div className="space-y-3 text-sm">
            <p className="text-xs text-zinc-500" translate="no">{`${detail.model} · version de réglages ${detail.settings_version || "—"} · ${detail.tool_rounds} tour(s) d'outils · cache ${detail.cache_read_tokens} jetons`}</p>
            {detail.error && <p className="text-red-700">{detail.error}</p>}
            <div>
              <p className="mb-1 font-medium">Réponse</p>
              <p className="whitespace-pre-wrap rounded bg-zinc-50 p-2" translate="no" dir="auto">{detail.response || "—"}</p>
            </div>
            <div>
              <p className="mb-1 font-medium">Outils appelés (passeport/CIN masqués)</p>
              <pre className="max-h-80 overflow-auto rounded bg-zinc-50 p-2 text-xs" dir="ltr">{JSON.stringify(detail.tools, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ScoreSelect({ value, onChange }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-md border px-2 py-1">
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function AuditItem({ item, onSaved }) {
  const [review, setReview] = useState({
    accuracy: item.accuracy ?? "",
    tone: item.tone ?? "",
    transfer_ok: item.transfer_ok == null ? "" : String(Boolean(item.transfer_ok)),
    invented_info: Boolean(item.invented_info),
    comment: item.comment || "",
  });
  const [msg, setMsg] = useState(null);
  return (
    <tr>
      <td>
        {item.conversation_id ? (
          <Link href={`/admin/whatsapp/conversations/${item.conversation_id}`} target="_blank" translate="no">
            {item.profile_name || `+${item.phone}`}
          </Link>
        ) : (
          "—"
        )}
        <div className="text-xs text-zinc-500">{item.transfer_reason ? `${item.ai_turns} réponse(s) IA · transfert : ${REASONS[item.transfer_reason] || item.transfer_reason}` : `${item.ai_turns} réponse(s) IA`}</div>
      </td>
      <td>
        <ScoreSelect value={review.accuracy} onChange={(v) => setReview((r) => ({ ...r, accuracy: v }))} />
      </td>
      <td>
        <ScoreSelect value={review.tone} onChange={(v) => setReview((r) => ({ ...r, tone: v }))} />
      </td>
      <td>
        <select value={review.transfer_ok} onChange={(e) => setReview((r) => ({ ...r, transfer_ok: e.target.value }))} className="rounded-md border px-2 py-1">
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </td>
      <td className="text-center">
        <input type="checkbox" checked={review.invented_info} onChange={(e) => setReview((r) => ({ ...r, invented_info: e.target.checked }))} />
      </td>
      <td>
        <input value={review.comment} onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))} className="w-full rounded-md border px-2 py-1" />
      </td>
      <td className="gf-actions">
        <button
          type="button"
          className={item.reviewed_at ? "gf-btn-outline" : "gf-btn-primary"}
          onClick={async () => {
            const res = await fetch("/api/admin/whatsapp/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", itemId: item.id, review }) });
            const data = await res.json().catch(() => ({}));
            setMsg(res.ok ? "✓" : data.message || "Erreur");
            if (res.ok) onSaved();
          }}
        >
          {item.reviewed_at ? "Mettre à jour" : "Valider"}
        </button>
        {msg && <span className="ms-1 text-xs">{msg}</span>}
      </td>
    </tr>
  );
}

function QualityTab() {
  const [audits, setAudits] = useState(null);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const loadAudits = useCallback(async () => {
    const res = await fetch("/api/admin/whatsapp/journal?type=audits");
    if (res.ok) setAudits(await res.json());
  }, []);
  const open = useCallback(async (id) => {
    const res = await fetch(`/api/admin/whatsapp/journal?type=audit_detail&id=${id}`);
    if (res.ok) setCurrent(await res.json());
  }, []);
  useEffect(() => fetchJson("/api/admin/whatsapp/journal?type=audits", setAudits), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="gf-btn-primary"
          onClick={async () => {
            setError(null);
            const res = await fetch("/api/admin/whatsapp/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_audit" }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return setError(data.message || "Impossible");
            await loadAudits();
            open(data.id);
          }}
        >
          <Icon name="science" size={16} />
          Tirer 20 conversations des 7 derniers jours
        </button>
        <span className="text-xs text-zinc-500">Un audit est aussi créé automatiquement chaque lundi.</span>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
      <div className="gf-card overflow-hidden">
        {!audits ? (
          <div className="gf-empty">Chargement...</div>
        ) : audits.length === 0 ? (
          <div className="gf-empty">Aucun audit.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Période</th>
                <th>Avancement</th>
                <th className="gf-num">Exactitude</th>
                <th className="gf-num">Ton</th>
                <th className="gf-num">Infos inventées</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td>{`${a.period_start} → ${a.period_end}`}</td>
                  <td>{`${a.reviewed}/${a.items}${a.status === "termine" ? " ✓" : ""}`}</td>
                  <td className="gf-num">{a.avg_accuracy == null ? "—" : `${Number(a.avg_accuracy).toFixed(1)}/5`}</td>
                  <td className="gf-num">{a.avg_tone == null ? "—" : `${Number(a.avg_tone).toFixed(1)}/5`}</td>
                  <td className="gf-num" style={Number(a.invented) ? { color: "var(--gf-danger)", fontWeight: 600 } : undefined}>
                    {Number(a.invented || 0)}
                  </td>
                  <td className="gf-actions">
                    <button type="button" className="gf-btn-outline" onClick={() => open(a.id)}>
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {current && (
        <Modal title={`Audit qualité ${current.audit.period_start} → ${current.audit.period_end}`} onClose={() => setCurrent(null)} size="xl">
          <p className="mb-3 text-xs text-zinc-500">
            Grille : exactitude (aucune information fausse ni inventée), ton (adapté, poli, dans la langue du client), transfert pertinent (ou absence de transfert justifiée). Tolérance zéro pour les informations inventées.
          </p>
          <table className="gf-table w-full text-sm">
            <thead>
              <tr>
                <th>Conversation</th>
                <th>Exactitude</th>
                <th>Ton</th>
                <th>Transfert pertinent</th>
                <th>Info inventée</th>
                <th>Commentaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {current.items.map((item) => (
                <AuditItem key={item.id} item={item} onSaved={loadAudits} />
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

export default function JournalView({ initialTab, staff, defaultFrom, today }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="space-y-4">
      <div className="gf-segmented self-start">
        {[
          ["audit", "Journal d'audit"],
          ["ia", "Logs IA"],
          ["qualite", "Audit qualité hebdomadaire"],
        ].map(([k, label]) => (
          <button key={k} type="button" data-active={tab === k ? "true" : undefined} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "audit" && <AuditLogTab staff={staff} defaultFrom={defaultFrom} today={today} />}
      {tab === "ia" && <IaLogsTab defaultFrom={defaultFrom} today={today} />}
      {tab === "qualite" && <QualityTab />}
    </div>
  );
}
