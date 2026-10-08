"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../../_components/Icon";
import Modal from "../../_components/Modal";
import { useConfirm } from "../../_components/useConfirm";
import { STAGES } from "../labels";

export const CAMPAIGN_STATUS = {
  brouillon: { label: "Brouillon", bg: "#f1f1ee", fg: "#5a5a60" },
  a_valider: { label: "À valider", bg: "#fff4e0", fg: "#a35a00" },
  validee: { label: "Validée", bg: "#e8f0fd", fg: "#2b5cc4" },
  en_cours: { label: "En cours", bg: "#e8f0fd", fg: "#2b5cc4" },
  terminee: { label: "Terminée", bg: "#e6f4ee", fg: "#0f6b4b" },
  arretee: { label: "Arrêtée", bg: "#fdecec", fg: "#c4373b" },
  refusee: { label: "Refusée", bg: "#fdecec", fg: "#c4373b" },
};

const LANGUAGES = { darija_latin: "Darija (latin)", darija_arabe: "Darija (arabe)", ar: "Arabe", fr: "Français", en: "Anglais" };
const TRAVEL_TYPES = ["omra", "hajj", "voyage"];
const EMPTY_FILTERS = { stages: [], travel_types: [], program_ids: [], sources: [], languages: [], city: "", former_pilgrims: false, last_interaction: null };

export function StatusPill({ status }) {
  const s = CAMPAIGN_STATUS[status] || CAMPAIGN_STATUS.brouillon;
  return (
    <span className="gf-pill" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

async function api(body) {
  const res = await fetch("/api/admin/whatsapp/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Action impossible");
  return data;
}

// Date locale (champ datetime-local) → ISO UTC, et inverse.
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const toLocalInput = (utc) => {
  if (!utc) return "";
  const d = new Date(`${String(utc).replace(" ", "T")}Z`);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatDate = (utc) => (utc ? new Date(`${String(utc).replace(" ", "T")}Z`).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

function Toggles({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(options).map(([k, label]) => {
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            className="gf-chip"
            style={on ? { background: "var(--gf-accent-soft)", color: "var(--gf-accent-ink)", borderColor: "var(--gf-accent)" } : undefined}
            onClick={() => onChange(on ? value.filter((v) => v !== k) : [...value, k])}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Wizard({ initial, segments, setSegments, templates, programs, sources, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    id: initial?.id || null,
    name: initial?.name || "",
    segment_id: initial?.segment_id || "",
    filters: { ...EMPTY_FILTERS, ...(initial?.filters || {}) },
    template_name: initial?.template_name || "",
    template_b_name: initial?.template_b_name || "",
    free_text: initial?.free_text || "",
    ab_test_percent: initial?.ab_test_percent || 10,
    ab_wait_hours: initial?.ab_wait_hours || 4,
    ab_metric: initial?.ab_metric || "reponses",
    scheduled_local: toLocalInput(initial?.scheduled_at),
    batch_size: initial?.batch_size || 200,
  }));
  const [preview, setPreview] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFilter = (patch) => setForm((f) => ({ ...f, filters: { ...f.filters, ...patch } }));
  const abEnabled = Boolean(form.template_b_name);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const payload = () => ({
    id: form.id,
    name: form.name,
    segment_id: form.segment_id || null,
    filters: form.filters,
    template_name: form.template_name,
    template_b_name: form.template_b_name || null,
    free_text: form.free_text,
    ab_test_percent: abEnabled ? form.ab_test_percent : 0,
    ab_wait_hours: form.ab_wait_hours,
    ab_metric: form.ab_metric,
    scheduled_at: toIso(form.scheduled_local),
    batch_size: form.batch_size,
  });

  const steps = ["Segment", "Template et variables", "Planification et test A/B", "Récapitulatif"];

  return (
    <Modal title={form.id ? "Modifier la campagne" : "Nouvelle campagne"} onClose={onClose} size="xl">
      <div className="space-y-5">
        <div className="gf-segmented">
          {steps.map((label, i) => (
            <button key={label} type="button" data-active={step === i + 1 ? "true" : undefined} onClick={() => setStep(i + 1)}>
              <span translate="no">{`${i + 1}.`}</span>
              {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                Segment enregistré
                <select
                  value={form.segment_id}
                  onChange={(e) => {
                    const seg = segments.find((s) => String(s.id) === e.target.value);
                    set({ segment_id: e.target.value, filters: seg ? { ...EMPTY_FILTERS, ...seg.filters } : form.filters });
                    setPreview(null);
                  }}
                  className="mt-1 block rounded-md border px-3 py-2"
                >
                  <option value="">— Filtres libres —</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <span>Étape du contact</span>
                <Toggles options={STAGES} value={form.filters.stages} onChange={(v) => setFilter({ stages: v })} />
              </div>
              <div className="space-y-1 text-sm">
                <span>Type de voyage d&apos;intérêt</span>
                <Toggles options={Object.fromEntries(TRAVEL_TYPES.map((t) => [t, t === "voyage" ? "Voyage organisé" : t === "omra" ? "Omra" : "Hajj"]))} value={form.filters.travel_types} onChange={(v) => setFilter({ travel_types: v })} />
              </div>
              <div className="space-y-1 text-sm">
                <span>Langue</span>
                <Toggles options={LANGUAGES} value={form.filters.languages} onChange={(v) => setFilter({ languages: v })} />
              </div>
              <div className="space-y-1 text-sm">
                <span>Source</span>
                {sources.length ? (
                  <Toggles options={Object.fromEntries(sources.map((s) => [s, s]))} value={form.filters.sources} onChange={(v) => setFilter({ sources: v })} />
                ) : (
                  <p className="text-xs text-zinc-500">Aucune source enregistrée.</p>
                )}
              </div>
              <label className="text-sm">
                Programme (inscrits ou intéressés)
                <select
                  multiple
                  value={form.filters.program_ids.map(String)}
                  onChange={(e) => setFilter({ program_ids: [...e.target.selectedOptions].map((o) => Number(o.value)) })}
                  className="mt-1 block h-28 w-full rounded-md border px-2 py-1"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-3 text-sm">
                <label className="block">
                  Ville de départ
                  <input value={form.filters.city} onChange={(e) => setFilter({ city: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" placeholder="Casablanca" />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  Dernière interaction
                  <select
                    value={form.filters.last_interaction?.mode || ""}
                    onChange={(e) => setFilter({ last_interaction: e.target.value ? { mode: e.target.value, days: form.filters.last_interaction?.days || 30 } : null })}
                    className="rounded-md border px-2 py-1"
                  >
                    <option value="">indifférente</option>
                    <option value="within">depuis moins de</option>
                    <option value="older">depuis plus de</option>
                  </select>
                  {form.filters.last_interaction && (
                    <>
                      <input
                        type="number"
                        min={1}
                        value={form.filters.last_interaction.days}
                        onChange={(e) => setFilter({ last_interaction: { ...form.filters.last_interaction, days: Number(e.target.value) } })}
                        className="w-20 rounded-md border px-2 py-1"
                      />
                      jours
                    </>
                  )}
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.filters.former_pilgrims} onChange={(e) => setFilter({ former_pilgrims: e.target.checked })} />
                  Anciens pèlerins uniquement
                </label>
              </div>
            </div>
            <p className="text-xs text-zinc-500">Seuls les contacts ayant donné leur consentement marketing et non bloqués sont retenus (consentement revérifié juste avant chaque envoi).</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="gf-btn-outline" disabled={busy} onClick={() => run(async () => setPreview(await api({ action: "preview", filters: form.filters })))}>
                <Icon name="visibility" size={16} />
                Compter les contacts
              </button>
              <input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="Nom du segment" className="rounded-md border px-3 py-2 text-sm" />
              <button
                type="button"
                className="gf-btn-outline"
                disabled={busy || !segmentName.trim()}
                onClick={() =>
                  run(async () => {
                    const data = await api({ action: "save_segment", segment: { name: segmentName, filters: form.filters } });
                    setSegments(data.segments);
                    setSegmentName("");
                  })
                }
              >
                Enregistrer comme segment
              </button>
            </div>
            {preview && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{`${preview.count} contact(s) consentant(s) dans ce segment`}</p>
                {preview.sample.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500" translate="no">
                    {preview.sample.map((c) => c.profile_name || `+${c.phone}`).join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm">
              Template (variante A)
              <select value={form.template_name} onChange={(e) => set({ template_name: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2">
                <option value="">Choisir…</option>
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {`${t.name} — ${t.category || "?"} — ${t.languages.join(", ")}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Texte libre (variable « texte saisi au moment de l&apos;envoi »)
              <textarea value={form.free_text} onChange={(e) => set({ free_text: e.target.value })} rows={2} maxLength={500} className="mt-1 block w-full rounded-md border px-3 py-2" dir="auto" />
            </label>
            <p className="text-xs text-zinc-500">Les autres variables (prénom, programme, dates...) sont remplies pour chaque contact depuis le CRM, selon la correspondance définie dans le template. La langue envoyée suit celle du contact.</p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Date et heure d&apos;envoi (vide = dès la validation)
              <input type="datetime-local" value={form.scheduled_local} onChange={(e) => set({ scheduled_local: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" />
              <span className="text-xs text-zinc-500">Envoi uniquement entre 9h et 21h, jamais le vendredi de 12h à 14h.</span>
            </label>
            <label className="block text-sm">
              Taille des lots (messages par minute)
              <input type="number" min={10} max={1000} value={form.batch_size} onChange={(e) => set({ batch_size: Number(e.target.value) })} className="mt-1 block w-full rounded-md border px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              Test A/B : template de la variante B (vide = pas de test)
              <select value={form.template_b_name} onChange={(e) => set({ template_b_name: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2">
                <option value="">Pas de test A/B</option>
                {templates
                  .filter((t) => t.name !== form.template_name)
                  .map((t) => (
                    <option key={t.name} value={t.name}>
                      {`${t.name} — ${t.category || "?"}`}
                    </option>
                  ))}
              </select>
            </label>
            {abEnabled && (
              <>
                <label className="block text-sm">
                  Part du segment testée (%)
                  <input type="number" min={2} max={50} value={form.ab_test_percent} onChange={(e) => set({ ab_test_percent: Number(e.target.value) })} className="mt-1 block w-full rounded-md border px-3 py-2" />
                </label>
                <label className="block text-sm">
                  Délai avant de choisir le gagnant (heures)
                  <input type="number" min={1} max={72} value={form.ab_wait_hours} onChange={(e) => set({ ab_wait_hours: Number(e.target.value) })} className="mt-1 block w-full rounded-md border px-3 py-2" />
                </label>
                <label className="block text-sm">
                  Critère du gagnant
                  <select value={form.ab_metric} onChange={(e) => set({ ab_metric: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2">
                    <option value="reponses">Taux de réponse</option>
                    <option value="lus">Taux de lecture</option>
                  </select>
                </label>
                <p className="text-xs text-zinc-500 sm:col-span-2">{`${form.ab_test_percent} % des contacts reçoivent A ou B (moitié chacun) ; après ${form.ab_wait_hours} h, la variante gagnante est envoyée au reste du segment.`}</p>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <label className="block text-sm">
              Nom de la campagne
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1 block w-full rounded-md border px-3 py-2" placeholder="Omra Ramadan 2027 — anciens pèlerins" />
            </label>
            <button type="button" className="gf-btn-outline" disabled={busy || !form.template_name} onClick={() => run(async () => setEstimate(await api({ action: "estimate", filters: form.filters, template_name: form.template_name })))}>
              <Icon name="savings" size={16} />
              Estimer le coût
            </button>
            {estimate && (
              <div className="rounded-lg border p-3 text-sm">
                <p>{`${estimate.recipients} destinataire(s) × ${estimate.unitPrice} MAD (catégorie ${estimate.category}) ≈ ${estimate.cost} MAD`}</p>
                <p className="text-xs text-zinc-500">Estimation au tarif saisi dans les paramètres WhatsApp ; le coût réel est relevé dans les statuts Meta.</p>
              </div>
            )}
            <ul className="space-y-1 text-sm text-zinc-700">
              <li>{`Template : ${form.template_name || "—"}${abEnabled ? ` / B : ${form.template_b_name} (${form.ab_test_percent} %)` : ""}`}</li>
              <li>{`Envoi : ${form.scheduled_local ? new Date(form.scheduled_local).toLocaleString("fr-FR") : "dès la validation"} — lots de ${form.batch_size}`}</li>
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <button type="button" className="gf-btn-outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Précédent
          </button>
          {step < 4 ? (
            <button type="button" className="gf-btn-primary" onClick={() => setStep((s) => s + 1)}>
              Suivant
            </button>
          ) : (
            <button
              type="button"
              className="gf-btn-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await api({ action: "save", campaign: payload() });
                  onSaved(data.campaign);
                })
              }
            >
              Enregistrer en brouillon
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function CampaignsManager({ initialCampaigns, initialSegments, templates, programs, sources, canPrepare, canApprove }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [segments, setSegments] = useState(initialSegments);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  async function refresh() {
    const res = await fetch("/api/admin/whatsapp/campaigns");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns);
      setSegments(data.segments);
    }
  }

  async function act(body, question, done) {
    if (question && !(await confirm(question))) return;
    setMessage(null);
    try {
      await api(body);
      setMessage({ ok: true, text: done });
      refresh();
    } catch (e) {
      setMessage({ ok: false, text: e.message });
    }
  }

  return (
    <div className="space-y-4">
      {canPrepare && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="gf-btn-primary" onClick={() => setEditing({})}>
            <Icon name="add" size={16} />
            Nouvelle campagne
          </button>
        </div>
      )}
      {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}

      <div className="gf-card overflow-x-auto">
        {campaigns.length === 0 ? (
          <div className="gf-empty">Aucune campagne.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Campagne</th>
                <th>Statut</th>
                <th>Template</th>
                <th className="gf-num">Destinataires</th>
                <th className="gf-num">Coût estimé</th>
                <th>Envoi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/whatsapp/campagnes/${c.id}`} translate="no">
                      {c.name}
                    </Link>
                    {c.review_note && <p className="text-xs text-red-700">{`Refus : ${c.review_note}`}</p>}
                  </td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td className="font-mono text-xs" translate="no">
                    {c.template_name}
                    {c.template_b_name ? ` / ${c.template_b_name}` : ""}
                  </td>
                  <td className="gf-num">{c.recipients ? `${c.sent}/${c.recipients}` : c.estimated_recipients ?? "—"}</td>
                  <td className="gf-num">{c.estimated_cost == null ? "—" : `${c.estimated_cost} MAD`}</td>
                  <td>{c.scheduled_at ? formatDate(c.scheduled_at) : "dès validation"}</td>
                  <td className="gf-actions">
                    <div className="flex flex-wrap justify-end gap-1">
                      {canPrepare && ["brouillon", "refusee"].includes(c.status) && (
                        <>
                          <button type="button" className="gf-btn-outline" onClick={() => setEditing(c)}>
                            Modifier
                          </button>
                          <button type="button" className="gf-btn-outline" onClick={() => act({ action: "submit", id: c.id }, null, "Campagne soumise au responsable.")}>
                            Soumettre
                          </button>
                          <button type="button" className="gf-btn-outline" onClick={() => act({ action: "delete", id: c.id }, "Supprimer cette campagne ?", "Campagne supprimée.")}>
                            <Icon name="delete" size={16} />
                          </button>
                        </>
                      )}
                      {canApprove && c.status === "a_valider" && (
                        <>
                          <button
                            type="button"
                            className="gf-btn-primary"
                            onClick={() =>
                              act(
                                { action: "approve", id: c.id },
                                `Valider et lancer « ${c.name} » vers environ ${c.estimated_recipients} contact(s) (≈ ${c.estimated_cost} MAD) ? L'envoi partira à l'heure prévue.`,
                                "Campagne validée."
                              )
                            }
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            className="gf-btn-outline"
                            onClick={() => setRejecting({ id: c.id, note: "" })}
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {["validee", "en_cours"].includes(c.status) && (
                        <button
                          type="button"
                          className="gf-btn-outline"
                          style={{ color: "var(--gf-danger)" }}
                          onClick={() => act({ action: "stop", id: c.id }, `Arrêt d'urgence de « ${c.name} » : plus aucun message ne sera envoyé. Confirmer ?`, "Campagne arrêtée.")}
                        >
                          <Icon name="stop_circle" size={16} />
                          Arrêter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Wizard
          initial={editing.id ? editing : null}
          segments={segments}
          setSegments={setSegments}
          templates={templates}
          programs={programs}
          sources={sources}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage({ ok: true, text: "Campagne enregistrée en brouillon. Soumettez-la au responsable pour validation." });
            refresh();
          }}
        />
      )}
      {rejecting && (
        <Modal title="Refuser la campagne" onClose={() => setRejecting(null)} size="sm">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await act({ action: "reject", id: rejecting.id, note: rejecting.note }, null, "Campagne refusée.");
              setRejecting(null);
            }}
          >
            <label className="block text-sm">
              Motif du refus (transmis au marketing)
              <textarea required value={rejecting.note} onChange={(e) => setRejecting((r) => ({ ...r, note: e.target.value }))} rows={3} className="mt-1 block w-full rounded-md border px-3 py-2" />
            </label>
            <button type="submit" className="gf-btn-primary">
              Refuser
            </button>
          </form>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
