"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../../_components/Icon";
import { CONVERSATION_STATUS, PRIORITY, REASONS, TEAMS, SEND_STATUS, STAGES, formatDateTime } from "../../labels";

const REASON_OPTIONS = ["intention_achat", "negociation", "reclamation", "cas_particulier", "demande_humain", "question_religieuse", "recu_paiement", "urgence"];

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function Media({ m }) {
  if (!m.media_id) return null;
  const url = `/api/admin/whatsapp/media/${m.media_id}`;
  if (String(m.media_mime || "").startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        {/* Média privé servi par une route protégée : pas de next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-64 rounded-lg border border-zinc-200" />
      </a>
    );
  }
  if (String(m.media_mime || "").startsWith("audio/")) {
    return <audio controls src={url} className="mt-2 w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline">
      <Icon name="description" size={16} />
      Ouvrir le document
    </a>
  );
}

function AiFooter({ m, onEvaluate }) {
  const tools = parseJson(m.ia_tools) || [];
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  return (
    <div className="mt-1 text-[11px] text-zinc-500">
      <span>IA</span>
      {tools.length > 0 && <span translate="no"> · {tools.map((t) => t.name).join(", ")}</span>}
      {m.ia_cost != null && <span> · {Number(m.ia_cost).toFixed(4)} $</span>}
      {m.ia_evaluation ? (
        <span> · {m.ia_evaluation === "bonne" ? "évaluée bonne" : "à corriger"}</span>
      ) : (
        <span className="ms-2 inline-flex gap-2">
          <button type="button" className="hover:underline" onClick={() => onEvaluate(m.id, "bonne")}>
            Bonne réponse
          </button>
          <button type="button" className="hover:underline" onClick={() => setCorrecting((v) => !v)}>
            À corriger
          </button>
        </span>
      )}
      {correcting && (
        <div className="mt-2 flex gap-2">
          <input value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Bonne réponse attendue" className="flex-1 rounded-md border px-2 py-1 text-xs" />
          <button
            type="button"
            className="gf-btn-soft"
            onClick={() => {
              onEvaluate(m.id, "a_corriger", correction);
              setCorrecting(false);
            }}
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

function Draft({ m, onApprove, onReject, busy }) {
  const [text, setText] = useState(m.content || "");
  return (
    <div className="ms-auto max-w-[85%] rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-violet-700">
        <Icon name="smart_toy" size={14} />
        Réponse rédigée par l&apos;IA — à valider
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(8, Math.max(3, text.split("\n").length + 1))} className="w-full rounded-md border px-2 py-1 text-sm" />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} className="gf-btn-primary" onClick={() => onApprove(m.id, text)}>
          Valider et envoyer
        </button>
        <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => onReject(m.id)}>
          Rejeter
        </button>
      </div>
    </div>
  );
}

export default function ConversationView({ data, staff, quickReplies, templates, me, paymentGateways = [] }) {
  const router = useRouter();
  const { conversation: c, messages, registrations, history, windowOpen } = data;
  const [text, setText] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [templateParams, setTemplateParams] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const status = CONVERSATION_STATUS[c.status] || CONVERSATION_STATUS.ia;
  const priority = PRIORITY[c.priority];
  const qualification = parseJson(c.qualification);
  const template = templates.find((t) => String(t.id) === String(templateId));

  async function act(payload) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Action impossible");
      router.refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!windowOpen && !noteMode) {
      if (!template) return;
      if (await act({ action: "template", templateId: template.id, params: templateParams })) {
        setTemplateId("");
        setTemplateParams([]);
      }
      return;
    }
    if (!text.trim()) return;
    if (await act({ action: noteMode ? "note" : "message", text })) setText("");
  }

  const isMine = c.assigned_staff_id === me.id;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="gf-card flex min-h-[70vh] flex-col overflow-hidden lg:col-span-2">
        <div className="gf-card-head gf-divided flex-wrap">
          <div style={{ minWidth: 0 }}>
            <div className="text-lg font-semibold" translate="no" dir="auto">
              {c.traveler_name || c.profile_name || `+${c.phone}`}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="gf-phone" dir="ltr" translate="no">+{c.phone}</span>
              <span className="gf-pill" style={{ background: status.bg, color: status.fg }}>{status.label}</span>
              {priority && c.priority !== "normale" && (
                <span className="gf-pill" style={{ background: priority.bg, color: priority.fg }}>{priority.label}</span>
              )}
              {c.transfer_reason && <span>{REASONS[c.transfer_reason] || c.transfer_reason}</span>}
              {(c.assigned_name || c.team) && (
                <span>
                  → <span translate="no">{c.assigned_name || ""}</span>{c.team ? <> ({TEAMS[c.team] || c.team})</> : null}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(c.status !== "humain" || !isMine) && c.status !== "resolu" && (
              <button type="button" disabled={busy} className="gf-btn-primary" onClick={() => act({ action: "takeover" })}>
                Prendre la main
              </button>
            )}
            {c.status !== "ia" && c.status !== "resolu" && (
              <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => act({ action: "giveback" })}>
                Rendre à l&apos;IA
              </button>
            )}
            {c.status === "ia" && (
              <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => act({ action: "giveback", copilot: true })}>
                Mode copilote
              </button>
            )}
            {c.status === "humain" && (
              <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => act({ action: "waiting" })}>
                En attente client
              </button>
            )}
            {c.status !== "resolu" && (
              <button type="button" disabled={busy} className="gf-btn-soft" onClick={() => act({ action: "resolve" })}>
                Résoudre
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4" style={{ maxHeight: "60vh" }}>
          {messages.length === 0 && <p className="text-sm text-zinc-500">Aucun message.</p>}
          {messages.map((m) => {
            if (m.is_private_note) {
              return (
                <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap">
                  <div className="mb-1 text-[11px] text-amber-700">
                    Note interne · {m.staff_name ? <span translate="no">{m.staff_name}</span> : "système"} · {formatDateTime(m.created_at)}
                  </div>
                  <span translate="no" dir="auto">{m.content}</span>
                </div>
              );
            }
            if (m.draft_status === "brouillon") {
              return (
                <Draft
                  key={m.id}
                  m={m}
                  busy={busy}
                  onApprove={(messageId, t) => act({ action: "approve-draft", messageId, text: t })}
                  onReject={(messageId) => act({ action: "reject-draft", messageId })}
                />
              );
            }
            if (m.draft_status === "rejete") return null;
            const inbound = m.direction === "entrant";
            return (
              <div key={m.id} className={`max-w-[85%] ${inbound ? "" : "ms-auto"}`}>
                <div
                  className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    inbound ? "border border-zinc-200 bg-white" : m.author === "ia" ? "bg-emerald-50" : "bg-sky-50"
                  }`}
                >
                  {m.type === "template" && <div className="mb-1 text-[11px] text-zinc-500">Template</div>}
                  <span translate="no" dir="auto">{m.content || (m.transcription ? "" : `[${m.type}]`)}</span>
                  {m.transcription && (
                    <div className="mt-1 text-xs text-zinc-600">
                      <Icon name="mic" size={12} /> <span translate="no">{m.transcription}</span>
                    </div>
                  )}
                  {m.media_doc_type && <span className="gf-chip ms-1">{m.media_doc_type}</span>}
                  <Media m={m} />
                </div>
                <div className={`mt-0.5 text-[11px] text-zinc-400 ${inbound ? "" : "text-end"}`}>
                  {inbound ? "Client" : m.author === "ia" ? "Assistant IA" : m.author === "humain" ? <span translate="no">{m.staff_name || "Conseiller"}</span> : "Système"}
                  {" · "}
                  {formatDateTime(m.created_at)}
                  {!inbound && m.status && (
                    <>
                      {" · "}
                      {SEND_STATUS[m.status] || m.status}
                    </>
                  )}
                  {m.error_message && <span className="text-red-600"> · {m.error_message}</span>}
                </div>
                {!inbound && m.ia_log_id && m.author === "ia" && (
                  <AiFooter m={m} onEvaluate={(messageId, evaluation, correction) => act({ action: "evaluate", messageId, evaluation, correction })} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} className="border-t border-zinc-200 p-3">
          {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={noteMode} onChange={(e) => setNoteMode(e.target.checked)} />
              Note interne (non envoyée au client)
            </label>
            {!windowOpen && !noteMode && (
              <span className="text-amber-700">Fenêtre de 24h fermée : seul un template approuvé par Meta peut être envoyé.</span>
            )}
          </div>
          {windowOpen || noteMode ? (
            <>
              {!noteMode && quickReplies.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const r = quickReplies.find((x) => String(x.id) === e.target.value);
                    if (r) setText((t) => `${t}${t ? "\n" : ""}${r.text_fr || r.text_ar || ""}`);
                  }}
                  className="mb-2 rounded-md border px-2 py-1 text-xs"
                >
                  <option value="">Réponse rapide…</option>
                  {quickReplies.map((r) => (
                    <option key={r.id} value={r.id} translate="no">
                      /{r.shortcut}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={noteMode ? "Note pour l'équipe…" : "Votre réponse au client…"}
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <button type="submit" disabled={busy || !text.trim()} className="gf-btn-primary self-end">
                  <Icon name="send" size={16} />
                  {noteMode ? "Ajouter" : "Envoyer"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Aucun template approuvé. Synchronisez les templates depuis les paramètres WhatsApp.
                </p>
              ) : (
                <>
                  <select
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      const t = templates.find((x) => String(x.id) === e.target.value);
                      setTemplateParams(Array.from({ length: t?.unmapped?.length || 0 }, () => ""));
                    }}
                    className="w-full rounded-md border px-2 py-2 text-sm"
                  >
                    <option value="">Choisir un template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.language})
                      </option>
                    ))}
                  </select>
                  {template && (
                    <>
                      <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm whitespace-pre-wrap" translate="no">
                        {template.preview}
                      </p>
                      {templateParams.map((v, i) => (
                        <input
                          key={i}
                          value={v}
                          onChange={(e) => setTemplateParams((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                          placeholder={`Variable ${template.unmapped[i]}`}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                      ))}
                      <button type="submit" disabled={busy || templateParams.some((v) => !v.trim())} className="gf-btn-primary">
                        Envoyer le template
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </form>
      </section>

      <aside className="space-y-4">
        <div className="gf-card p-4 text-sm">
          <h2 className="gf-card-title mb-3">
            <Icon name="person" size={18} />
            Fiche contact
          </h2>
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Étape</dt>
              <dd>{STAGES[c.stage] || c.stage}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Langue</dt>
              <dd translate="no">{c.language || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Source</dt>
              <dd translate="no">{c.source || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Client depuis</dt>
              <dd>{formatDateTime(c.contact_created_at, { year: "numeric", hour: undefined, minute: undefined })}</dd>
            </div>
          </dl>
          {qualification && Object.keys(qualification).length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-zinc-500">Qualification</div>
              <ul className="space-y-0.5 text-xs" translate="no">
                {Object.entries(qualification).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-zinc-500">{k} :</span> {String(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-zinc-500">
              Conseiller attitré
              <select
                value={c.advisor_staff_id || ""}
                onChange={(e) => act({ action: "contact", contact: { advisorStaffId: e.target.value ? Number(e.target.value) : null } })}
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              >
                <option value="">—</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(c.marketing_opt_in)} onChange={(e) => act({ action: "contact", contact: { marketingOptIn: e.target.checked } })} />
              Accepte les messages marketing
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(c.blocked)} onChange={(e) => act({ action: "contact", contact: { blocked: e.target.checked } })} />
              Numéro bloqué (aucune réponse)
            </label>
          </div>
        </div>

        <div className="gf-card p-4 text-sm">
          <h2 className="gf-card-title mb-2">
            <Icon name="luggage" size={18} />
            Dossiers
          </h2>
          {registrations.length === 0 ? (
            <p className="text-xs text-zinc-500">{c.traveler_id ? "Aucune inscription." : "Prospect : aucun voyageur inscrit avec ce numéro."}</p>
          ) : (
            <ul className="space-y-1">
              {registrations.map((r) => (
                <li key={r.id}>
                  <Link href={r.group_id ? `/admin/groupes/${r.group_id}` : `/admin/inscriptions/${r.id}`} className="text-emerald-700 hover:underline" translate="no">
                    {r.program_title}
                  </Link>
                  <span className="text-xs text-zinc-500"> · {String(r.departure_date).slice(0, 10)} · {r.status}</span>
                  {paymentGateways.length > 0 && r.status !== "annule" && r.status !== "paye_complet" && (
                    <button
                      type="button"
                      disabled={busy}
                      className="ms-2 text-xs text-emerald-700 hover:underline"
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          const res = await fetch("/api/admin/paiements-en-ligne", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "create", provider: paymentGateways[0].provider, registrationId: r.id, conversationId: c.id }),
                          });
                          const link = await res.json();
                          if (!res.ok) throw new Error(link.message || "Lien impossible");
                          setNoteMode(false);
                          setText((t) => `${t}${t ? "\n" : ""}${link.url}`);
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Lien de paiement
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gf-card p-4 text-sm">
          <h2 className="gf-card-title mb-2">
            <Icon name="support_agent" size={18} />
            Transfert
          </h2>
          <div className="flex gap-2">
            <select value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className="flex-1 rounded-md border px-2 py-1 text-sm">
              <option value="">Motif…</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {REASONS[r]}
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || !transferReason} className="gf-btn-outline" onClick={() => act({ action: "transfer", reason: transferReason })}>
              Transférer
            </button>
          </div>
          <button type="button" className="mt-3 text-xs text-emerald-700 hover:underline" onClick={() => setReassignOpen((v) => !v)}>
            Réassigner à un collègue
          </button>
          {reassignOpen && (
            <div className="mt-2 space-y-2">
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="">Collègue…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({TEAMS[s.role] || s.role})
                  </option>
                ))}
              </select>
              <textarea value={reassignNote} onChange={(e) => setReassignNote(e.target.value)} rows={2} placeholder="Note obligatoire" className="w-full rounded-md border px-2 py-1 text-sm" />
              <button
                type="button"
                disabled={busy || !reassignTo || !reassignNote.trim()}
                className="gf-btn-primary"
                onClick={async () => {
                  if (await act({ action: "reassign", staffId: Number(reassignTo), note: reassignNote })) {
                    setReassignOpen(false);
                    setReassignNote("");
                  }
                }}
              >
                Réassigner
              </button>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="gf-card p-4 text-sm">
            <h2 className="gf-card-title mb-2">
              <Icon name="schedule" size={18} />
              Conversations précédentes
            </h2>
            <ul className="space-y-1 text-xs">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/admin/whatsapp/conversations/${h.id}`} className="text-emerald-700 hover:underline">
                    {formatDateTime(h.opened_at, { year: "numeric" })}
                  </Link>{" "}
                  · {(CONVERSATION_STATUS[h.status] || {}).label || h.status}
                  {h.transfer_reason ? ` · ${REASONS[h.transfer_reason] || h.transfer_reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
