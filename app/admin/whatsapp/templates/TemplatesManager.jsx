"use client";

import { useMemo, useState } from "react";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { formatDateTime } from "../labels";

const STATUS = {
  BROUILLON: { label: "Brouillon", bg: "#f1f1ee", fg: "#5a5a60" },
  PENDING: { label: "En attente Meta", bg: "#fff4e0", fg: "#a35a00" },
  APPROVED: { label: "Approuvé", bg: "#e6f4ee", fg: "#0f6b4b" },
  REJECTED: { label: "Refusé", bg: "#fdecec", fg: "#c4373b" },
  PAUSED: { label: "En pause", bg: "#fff4e0", fg: "#a35a00" },
  DISABLED: { label: "Désactivé", bg: "#fdecec", fg: "#c4373b" },
};
const CATEGORY = { UTILITY: "Utilité", MARKETING: "Marketing", AUTHENTICATION: "Authentification" };
const LANG = { fr: "Français", ar: "Arabe", en: "Anglais" };
const HEADER = { NONE: "Aucun", TEXT: "Texte", IMAGE: "Image", DOCUMENT: "Document", LOCATION: "Localisation" };
const BUTTON = { QUICK_REPLY: "Réponse rapide", URL: "Lien", PHONE_NUMBER: "Appel" };

const EMPTY = {
  name: "",
  language: "fr",
  category: "UTILITY",
  description: "",
  simple: { headerType: "NONE", headerText: "", body: "", footer: "", buttons: [] },
  mapping: {},
};

const varsOf = (text) => [...new Set([...String(text || "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);

async function api(body) {
  const res = await fetch("/api/admin/whatsapp/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Action impossible");
  return data;
}

function PhonePreview({ rendered, simple }) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-[28px] border-8 border-zinc-800 bg-[#e5ddd5] p-3" dir="auto">
      <div className="rounded-lg bg-white p-2 text-sm shadow-sm">
        {simple.headerType === "TEXT" && rendered.header && <div className="mb-1 font-semibold">{rendered.header}</div>}
        {["IMAGE", "DOCUMENT", "LOCATION"].includes(simple.headerType) && (
          <div className="mb-2 grid h-24 place-items-center rounded bg-zinc-100 text-xs text-zinc-500">{HEADER[simple.headerType]}</div>
        )}
        <div className="whitespace-pre-wrap" translate="no">{rendered.body || " "}</div>
        {simple.footer && <div className="mt-1 text-xs text-zinc-400" translate="no">{simple.footer}</div>}
      </div>
      {(simple.buttons || []).filter((b) => b.text).map((b, i) => (
        <div key={i} className="mt-1 rounded-lg bg-white py-1.5 text-center text-sm text-sky-600 shadow-sm" translate="no">
          {b.text}
        </div>
      ))}
    </div>
  );
}

function Editor({ initial, fields, registrations, onSaved, onClose }) {
  const [t, setT] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [check, setCheck] = useState(null);
  const [previewReg, setPreviewReg] = useState("");
  const [rendered, setRendered] = useState(null);
  const [headerSample, setHeaderSample] = useState("");
  const locked = initial.id && ["APPROVED", "PENDING"].includes(initial.status);
  const set = (patch) => setT((x) => ({ ...x, ...patch }));
  const setSimple = (patch) => setT((x) => ({ ...x, simple: { ...x.simple, ...patch } }));
  const fieldLabel = (key) => fields.find((f) => f.key === key)?.label || key;

  // Variables présentes dans le texte → champs CRM à associer (TP-05).
  const slots = useMemo(() => {
    const out = [];
    if (t.simple.headerType === "TEXT") varsOf(t.simple.headerText).forEach((n) => out.push({ key: `header.${n}`, label: `En-tête {{${n}}}` }));
    if (["IMAGE", "DOCUMENT"].includes(t.simple.headerType)) out.push({ key: "header.media", label: "URL du fichier d'en-tête" });
    varsOf(t.simple.body).forEach((n) => out.push({ key: `body.${n}`, label: `Corps {{${n}}}` }));
    (t.simple.buttons || []).forEach((b, i) => {
      if (b.type === "URL" && /\{\{1\}\}/.test(b.url || "")) out.push({ key: `button.${i}`, label: `Bouton ${i + 1} (fin d'URL)` });
    });
    return out;
  }, [t.simple]);

  // Aperçu local : exemples des champs ; ou données réelles d'un dossier (serveur).
  const localRendered = useMemo(() => {
    const ex = (key) => fields.find((f) => f.key === t.mapping[key])?.example || "…";
    const fill = (text, prefix) => String(text || "").replace(/\{\{(\d+)\}\}/g, (_, n) => ex(`${prefix}.${n}`));
    return { header: fill(t.simple.headerText, "header"), body: fill(t.simple.body, "body") };
  }, [t, fields]);

  const payload = () => ({ id: t.id, name: t.name, language: t.language, category: t.category, description: t.description, simple: t.simple, mapping: t.mapping });

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {locked && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {initial.status === "APPROVED"
              ? "Template approuvé : seule la correspondance des variables est modifiable. Dupliquez-le pour créer une nouvelle version."
              : "Template en cours d'examen : seule la correspondance des variables est modifiable. Dupliquez-le pour créer une nouvelle version."}
          </p>
        )}
        {initial.rejection_reason && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Motif du refus : <span translate="no">{initial.rejection_reason}</span></p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-3">
            Nom (minuscules, chiffres et _)
            <input value={t.name} disabled={locked} onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm" dir="ltr" />
          </label>
          <label className="text-sm">
            Langue
            <select value={t.language} disabled={locked} onChange={(e) => set({ language: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
              {Object.entries(LANG).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Catégorie demandée
            <select value={t.category} disabled={locked} onChange={(e) => set({ category: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
              {Object.entries(CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            En-tête
            <select value={t.simple.headerType} disabled={locked} onChange={(e) => setSimple({ headerType: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
              {Object.entries(HEADER).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Description interne
          <input value={t.description || ""} onChange={(e) => set({ description: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        {t.simple.headerType === "TEXT" && (
          <label className="block text-sm">
            {`Texte de l'en-tête (${(t.simple.headerText || "").length}/60)`}
            <input value={t.simple.headerText} disabled={locked} onChange={(e) => setSimple({ headerText: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
          </label>
        )}
        {["IMAGE", "DOCUMENT"].includes(t.simple.headerType) && !locked && (
          <label className="block text-sm">
            Fichier d&apos;exemple pour Meta (chemin d&apos;un fichier envoyé, ex. /uploads/agencies/1/programs/…)
            <input value={headerSample} onChange={(e) => setHeaderSample(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs" dir="ltr" />
          </label>
        )}
        <label className="block text-sm">
          {`Corps du message (${(t.simple.body || "").length}/1024) — variables : {{1}}, {{2}}…`}
          <textarea value={t.simple.body} disabled={locked} onChange={(e) => setSimple({ body: e.target.value })} rows={6} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" dir="auto" />
        </label>
        <label className="block text-sm">
          {`Pied de message (${(t.simple.footer || "").length}/60, sans variable)`}
          <input value={t.simple.footer} disabled={locked} onChange={(e) => setSimple({ footer: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" dir="auto" />
        </label>
        <div>
          <div className="mb-1 text-sm">Boutons</div>
          {(t.simple.buttons || []).map((b, i) => (
            <div key={i} className="mb-2 flex flex-wrap gap-2">
              <select value={b.type} disabled={locked} onChange={(e) => setSimple({ buttons: t.simple.buttons.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} className="rounded-md border px-2 py-1 text-sm">
                {Object.entries(BUTTON).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input value={b.text} disabled={locked} onChange={(e) => setSimple({ buttons: t.simple.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Texte (25 max)" className="flex-1 rounded-md border px-2 py-1 text-sm" dir="auto" />
              {b.type === "URL" && (
                <input value={b.url} disabled={locked} onChange={(e) => setSimple({ buttons: t.simple.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://…{{1}}" className="flex-1 rounded-md border px-2 py-1 font-mono text-xs" dir="ltr" />
              )}
              {b.type === "PHONE_NUMBER" && (
                <input value={b.phone} disabled={locked} onChange={(e) => setSimple({ buttons: t.simple.buttons.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })} placeholder="+212…" className="w-36 rounded-md border px-2 py-1 text-sm" dir="ltr" />
              )}
              {!locked && (
                <button type="button" className="gf-btn-icon gf-danger" aria-label="Retirer" onClick={() => setSimple({ buttons: t.simple.buttons.filter((_, j) => j !== i) })}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          ))}
          {!locked && (t.simple.buttons || []).length < 10 && (
            <button type="button" className="gf-btn-soft" onClick={() => setSimple({ buttons: [...(t.simple.buttons || []), { type: "QUICK_REPLY", text: "", url: "", phone: "" }] })}>
              <Icon name="add" size={16} />
              Ajouter un bouton
            </button>
          )}
        </div>

        {slots.length > 0 && (
          <div className="rounded-lg border border-zinc-200 p-3">
            <div className="mb-2 text-sm font-medium">Variables ↔ champs du CRM</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <label key={s.key} className="text-xs">
                  {s.label}
                  <select value={t.mapping[s.key] || ""} onChange={(e) => set({ mapping: { ...t.mapping, [s.key]: e.target.value } })} className="mt-1 w-full rounded-md border px-2 py-1 text-sm">
                    <option value="">Choisir…</option>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {check && (
          <div className="space-y-1 text-sm">
            {check.errors.length === 0 && check.warnings.length === 0 && <p className="text-emerald-700">Aucun problème détecté.</p>}
            {check.errors.map((e, i) => (
              <p key={`e${i}`} className="text-red-700">✗ {e}</p>
            ))}
            {check.warnings.map((w, i) => (
              <p key={`w${i}`} className="text-amber-700">⚠ {w}</p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
          <button type="button" disabled={busy} className="gf-btn-primary" onClick={() => run(async () => { const saved = await api({ action: "save", template: payload() }); setT((x) => ({ ...x, id: saved.id })); onSaved(); return saved; })}>
            Enregistrer
          </button>
          <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => run(async () => setCheck(await api({ action: "validate", template: payload() })))}>
            Vérifier les règles Meta
          </button>
          {!locked && (
            <button
              type="button"
              disabled={busy}
              className="gf-btn-outline"
              onClick={() =>
                run(async () => {
                  const saved = await api({ action: "save", template: payload() });
                  await api({ action: "submit", id: saved.id, headerSample: headerSample || null });
                  onSaved();
                  onClose();
                })
              }
            >
              <Icon name="send" size={16} />
              Soumettre à Meta
            </button>
          )}
          <button type="button" className="gf-btn-soft" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="text-sm font-medium">Aperçu</div>
        <select
          value={previewReg}
          onChange={async (e) => {
            setPreviewReg(e.target.value);
            setRendered(e.target.value ? await run(() => api({ action: "preview", template: payload(), registrationId: e.target.value })) : null);
          }}
          className="w-full rounded-md border px-2 py-1 text-xs"
        >
          <option value="">Valeurs d&apos;exemple</option>
          {registrations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name} — {r.title}
            </option>
          ))}
        </select>
        <PhonePreview rendered={rendered || localRendered} simple={t.simple} />
      </aside>
    </div>
  );
}

export default function TemplatesManager({ initialTemplates, initialStats, fields, registrations }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [stats, setStats] = useState(initialStats);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const statsById = new Map(stats.map((s) => [s.id, s]));

  async function reload() {
    const res = await fetch("/api/admin/whatsapp/templates?all=1");
    const data = await res.json();
    setTemplates(data.templates);
    setStats(data.stats);
  }

  async function act(body, success) {
    setBusy(true);
    setMessage(null);
    try {
      const data = await api(body);
      await reload();
      if (success) setMessage({ ok: true, text: success(data) });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of templates) map.set(t.name, [...(map.get(t.name) || []), t]);
    return [...map.entries()];
  }, [templates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="gf-btn-primary" onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="add" size={16} />
          Nouveau template
        </button>
        <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => act({ action: "sync" }, (d) => `${d.count} template(s) synchronisé(s) depuis Meta.`)}>
          Synchroniser avec Meta
        </button>
        <button type="button" disabled={busy} className="gf-btn-outline" onClick={() => act({ action: "seed" }, (d) => `${d.created} brouillon(s) ajouté(s).`)}>
          Charger les 21 modèles proposés
        </button>
      </div>
      {message && <p className={`rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}

      <div className="gf-card overflow-hidden">
        {groups.length === 0 ? (
          <div className="gf-empty">Aucun template. Chargez les modèles proposés ou synchronisez ceux déjà créés chez Meta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gf-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Langue</th>
                  <th>Statut Meta</th>
                  <th>Catégorie (demandée → appliquée)</th>
                  <th>Envois 30 j</th>
                  <th>Lus / réponses</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.flatMap(([name, rows]) =>
                  rows.map((t, i) => {
                    const st = STATUS[t.status] || { label: t.status || "—", bg: "#f1f1ee", fg: "#5a5a60" };
                    const s = statsById.get(t.id) || {};
                    const reclassed = t.category && t.category_requested && t.category !== t.category_requested;
                    return (
                      <tr key={t.id}>
                        <td>
                          {i === 0 && (
                            <>
                              <div className="font-mono text-sm" translate="no">{name}</div>
                              {t.description && <div className="text-xs text-zinc-500" translate="no">{t.description}</div>}
                            </>
                          )}
                        </td>
                        <td>{LANG[t.language] || t.language}</td>
                        <td>
                          <span className="gf-pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                          {t.rejection_reason && <div className="text-xs text-red-600" translate="no">{t.rejection_reason}</div>}
                        </td>
                        <td className="text-sm">
                          {CATEGORY[t.category_requested] || t.category_requested || "—"}
                          {t.category && t.category !== t.category_requested && <> → {CATEGORY[t.category] || t.category}</>}
                          {reclassed && <span className="ms-1 text-amber-700">⚠</span>}
                        </td>
                        <td className="text-sm">{Number(s.sent || 0)}</td>
                        <td className="text-sm">
                          {Number(s.read_count || 0)} / {Number(s.replies || 0)}
                          {Number(s.failed || 0) > 0 && <span className="ms-1 text-red-600">{`(${s.failed} échec)`}</span>}
                        </td>
                        <td className="gf-actions">
                          <button
                            type="button"
                            className="gf-btn-icon"
                            aria-label="Modifier"
                            onClick={() =>
                              setEditing({
                                id: t.id,
                                status: t.status,
                                rejection_reason: t.rejection_reason,
                                name: t.name,
                                language: t.language,
                                category: t.category_requested || t.category || "UTILITY",
                                description: t.description || "",
                                simple: t.simple,
                                mapping: t.variable_mapping || {},
                              })
                            }
                          >
                            <Icon name="edit" size={18} />
                          </button>
                          <button
                            type="button"
                            className="gf-btn-icon"
                            aria-label="Dupliquer"
                            title="Dupliquer (autre langue ou nouvelle version)"
                            onClick={() => act({ action: "duplicate", id: t.id, language: t.language === "fr" ? "ar" : "fr", name: t.name }, () => "Copie créée dans l'autre langue.")}
                          >
                            <Icon name="content_copy" size={18} />
                          </button>
                          <button
                            type="button"
                            className="gf-btn-icon gf-danger"
                            aria-label="Supprimer"
                            onClick={async () => {
                              if (await confirm(t.meta_template_id ? "Supprimer ce template, y compris chez Meta (s'il s'agit de la dernière langue) ?" : "Supprimer ce brouillon ?")) act({ action: "delete", id: t.id }, () => "Template supprimé.");
                            }}
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Dernière synchronisation : {templates.some((t) => t.synced_at) ? formatDateTime(templates.map((t) => t.synced_at).filter(Boolean).sort().pop(), { year: "numeric" }) : "jamais"} — automatique toutes les heures.
      </p>

      {editing && (
        <Modal title={editing.id ? "Modifier le template" : "Nouveau template"} onClose={() => setEditing(null)} size="xl">
          <Editor initial={editing} fields={fields} registrations={registrations} onSaved={reload} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
