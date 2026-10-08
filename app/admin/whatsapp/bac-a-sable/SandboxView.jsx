"use client";

import { useState } from "react";
import Icon from "../../_components/Icon";
import { useConfirm } from "../../_components/useConfirm";
import { REASONS, formatDateTime } from "../labels";

async function api(method, body, query = "") {
  const res = await fetch(`/api/admin/whatsapp/sandbox${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Action impossible");
  return data;
}

function Effects({ result }) {
  const e = result.effects || {};
  return (
    <div className="mt-2 space-y-1 rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-600">
      <div>
        Résultat : <b>{result.outcome}</b> · {Number(result.cost || 0).toFixed(4)} $ · <span translate="no">{result.model}</span> · version {result.settingsVersion}
        {result.error && <span className="text-red-600"> · {result.error}</span>}
      </div>
      {result.toolCalls?.map((t, i) => (
        <details key={i}>
          <summary className="cursor-pointer" translate="no">
            Outil {t.name} ({t.ms} ms){t.error ? " — erreur" : ""}
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-2 text-[11px] whitespace-pre-wrap" translate="no">
            {JSON.stringify(t.input, null, 1)}
            {"\n→ "}
            {t.result}
          </pre>
        </details>
      ))}
      {e.transfer && (
        <div className="text-amber-700">
          Transfert simulé : {REASONS[e.transfer.reason] || e.transfer.reason} — <span translate="no">{e.transfer.summary}</span>
        </div>
      )}
      {e.tasks?.map((t, i) => (
        <div key={i}>Tâche simulée : <span translate="no">{t.title}</span></div>
      ))}
      {e.outbound?.map((o, i) => (
        <div key={i}>Envoi simulé : <span translate="no">{o.kind === "image" ? o.url : o.text}</span></div>
      ))}
    </div>
  );
}

export default function SandboxView({ aiConfigured, initialCases, initialRuns, versions, travelers }) {
  const [history, setHistory] = useState([]); // { role, text, result? }
  const [input, setInput] = useState("");
  const [travelerId, setTravelerId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cases, setCases] = useState(initialCases);
  const [runs, setRuns] = useState(initialRuns);
  const [newCase, setNewCase] = useState({ question: "", expectation: "", expectTransfer: "", travelerId: "" });
  const [run, setRun] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next = [...history, { role: "user", text }];
    setHistory(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const result = await api("POST", {
        action: "chat",
        history: next.map(({ role, text: t }) => ({ role, text: t })),
        travelerId: travelerId || null,
        settingsVersionId: versionId || null,
      });
      setHistory([...next, { role: "assistant", text: result.text || "(aucun texte)", result }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCase(e) {
    e.preventDefault();
    try {
      const data = await api("POST", { action: "save-case", testCase: newCase });
      setCases(data.cases);
      setNewCase({ question: "", expectation: "", expectTransfer: "", travelerId: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSuite() {
    if (!(await confirm(`Lancer les ${cases.filter((c) => c.is_active).length} tests ? Chaque test est un appel facturé à l'API Claude.`))) return;
    try {
      const { runKey } = await api("POST", { action: "run-suite" });
      setRun({ runKey, rows: [], pending: true });
      const poll = async () => {
        const data = await api("GET", null, `?run=${encodeURIComponent(runKey)}`);
        setRun({ runKey, ...data, pending: data.rows.length < cases.filter((c) => c.is_active).length });
        if (data.rows.length < cases.filter((c) => c.is_active).length) setTimeout(poll, 4000);
        else setRuns((await api("GET")).runs);
      };
      setTimeout(poll, 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openRun(runKey) {
    const data = await api("GET", null, `?run=${encodeURIComponent(runKey)}`);
    setRun({ runKey, ...data, pending: false });
  }

  return (
    <div className="space-y-6">
      {!aiConfigured && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          La clé API Claude (ANTHROPIC_API_KEY) n&apos;est pas configurée sur le serveur : le bac à sable ne peut pas fonctionner.
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided flex-wrap">
          <h2 className="gf-card-title">
            <Icon name="chat" size={18} />
            Conversation de test
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <select value={travelerId} onChange={(e) => setTravelerId(e.target.value)} className="rounded-md border px-2 py-1">
              <option value="">Client : prospect</option>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  Inscrit : {t.full_name}
                </option>
              ))}
            </select>
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="rounded-md border px-2 py-1">
              <option value="">Réglages actifs</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.version}
                  {v.is_active ? " " : ""}
                  {v.is_active ? "(active)" : ""}
                </option>
              ))}
            </select>
            <button type="button" className="gf-btn-outline" onClick={() => setHistory([])}>
              Nouvelle conversation
            </button>
          </div>
        </div>
        <div className="space-y-3 bg-zinc-50 p-4" style={{ minHeight: 240 }}>
          {history.length === 0 && <p className="text-sm text-zinc-500">Écrivez comme un client (darija, arabe, français...).</p>}
          {history.map((h, i) => (
            <div key={i} className={`max-w-[85%] ${h.role === "user" ? "" : "ms-auto"}`}>
              <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${h.role === "user" ? "border border-zinc-200 bg-white" : "bg-emerald-50"}`} translate="no" dir="auto">
                {h.text}
              </div>
              {h.result && <Effects result={h.result} />}
            </div>
          ))}
          {busy && <p className="text-sm text-zinc-500">L&apos;agent réfléchit…</p>}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 p-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message du client…" className="flex-1 rounded-md border px-3 py-2 text-sm" dir="auto" disabled={!aiConfigured} />
          <button type="submit" disabled={busy || !aiConfigured || !input.trim()} className="gf-btn-primary">
            <Icon name="send" size={16} />
            Envoyer
          </button>
        </form>
      </section>

      <section className="gf-card overflow-hidden">
        <div className="gf-card-head gf-divided">
          <h2 className="gf-card-title">
            <Icon name="task_alt" size={18} />
            {`Jeu de tests (${cases.length})`}
          </h2>
          <button type="button" className="gf-btn-primary" disabled={!aiConfigured || cases.length === 0} onClick={runSuite}>
            Lancer tous les tests
          </button>
        </div>
        <form onSubmit={saveCase} className="grid gap-2 border-b border-zinc-100 p-4 sm:grid-cols-6">
          <input required value={newCase.question} onChange={(e) => setNewCase((c) => ({ ...c, question: e.target.value }))} placeholder="Question du client" className="rounded-md border px-3 py-2 text-sm sm:col-span-2" dir="auto" />
          <input value={newCase.expectation} onChange={(e) => setNewCase((c) => ({ ...c, expectation: e.target.value }))} placeholder="Réponse attendue (critère)" className="rounded-md border px-3 py-2 text-sm sm:col-span-2" />
          <select value={newCase.expectTransfer} onChange={(e) => setNewCase((c) => ({ ...c, expectTransfer: e.target.value }))} className="rounded-md border px-2 py-2 text-sm">
            <option value="">Transfert : indifférent</option>
            <option value="oui">Transfert attendu</option>
            <option value="non">Pas de transfert</option>
          </select>
          <button type="submit" className="gf-btn-soft">
            <Icon name="add" size={16} />
            Ajouter
          </button>
        </form>
        {cases.length === 0 ? (
          <div className="gf-empty">Aucun test. Objectif du cahier des charges : 50 questions représentatives.</div>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {cases.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2">
                <div>
                  <span translate="no">{c.question}</span>
                  <div className="text-xs text-zinc-500">
                    {c.expectation && <span translate="no">{c.expectation} · </span>}
                    {c.expect_transfer == null ? "" : c.expect_transfer ? "transfert attendu" : "pas de transfert"}
                    {c.traveler_name && <span> · inscrit : <span translate="no">{c.traveler_name}</span></span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="gf-btn-icon gf-danger"
                  aria-label="Supprimer"
                  onClick={async () => {
                    if (await confirm("Supprimer ce test ?")) setCases((await api("POST", { action: "delete-case", id: c.id })).cases);
                  }}
                >
                  <Icon name="delete" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {runs.length > 0 && (
          <div className="border-t border-zinc-100 p-4 text-sm">
            <div className="mb-2 font-medium">Passages précédents</div>
            <ul className="space-y-1 text-xs">
              {runs.map((r) => (
                <li key={r.run_key}>
                  <button type="button" className="text-emerald-700 hover:underline" onClick={() => openRun(r.run_key)}>
                    {formatDateTime(r.started_at, { year: "numeric" })}
                  </button>{" "}
                  · {r.cases} tests · version {r.settings_version} · {Number(r.cost || 0).toFixed(3)} $ {Number(r.errors) > 0 ? `· ${r.errors} erreur(s)` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {run && (
        <section className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <h2 className="gf-card-title">Résultats {run.pending ? "(en cours…)" : ""}</h2>
            {run.previousKey && <span className="text-xs text-zinc-500">Comparé au passage précédent</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Réponse</th>
                  <th>Transfert</th>
                  <th>Passage précédent</th>
                </tr>
              </thead>
              <tbody>
                {run.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[16rem] text-sm" translate="no">{r.question}</td>
                    <td className="max-w-md text-sm whitespace-pre-wrap" translate="no">
                      {r.error ? <span className="text-red-600">{r.error}</span> : r.response}
                    </td>
                    <td className="text-sm">
                      {r.transferred ? "Oui" : "Non"}
                      {r.transfer_ok === false && <span className="ms-1 text-red-600">≠ attendu</span>}
                      {r.transfer_ok === true && <span className="ms-1 text-emerald-700">✓</span>}
                    </td>
                    <td className="max-w-md text-xs whitespace-pre-wrap text-zinc-500" translate="no">
                      {r.previous_response ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {confirmDialog}
    </div>
  );
}
