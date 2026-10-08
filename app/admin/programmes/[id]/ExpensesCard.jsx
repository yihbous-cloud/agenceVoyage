"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/admin/_components/Icon";
import { useConfirm } from "@/app/admin/_components/useConfirm";
import { formatMoney } from "@/app/admin/_components/statusStyles";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";
import {
  EXPENSE_CATEGORY_META,
  installmentState,
  localIso,
  summarizeExpenses,
  todayIso,
} from "@/lib/expenseState";

// Charges financières du programme (voyage principal) : coûts de l'agence
// par catégorie, chacun avec un échéancier de paiement (une ou plusieurs
// dates). Migration 035, permissions charges.view / charges.manage.
const PAYMENT_METHODS = ["virement", "especes", "cheque", "carte", "autre"];
const METHOD_LABELS = { virement: "Virement", especes: "Espèces", cheque: "Chèque", carte: "Carte", autre: "Autre" };

const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "");

function emptyForm() {
  return { category: "hotel", label: "", supplier: "", hotelId: "", airlineId: "", amount: "", notes: "", installments: [] };
}

function formFromExpense(e) {
  return {
    category: e.category,
    label: e.label,
    supplier: e.supplier || "",
    hotelId: e.hotel_id ? String(e.hotel_id) : "",
    airlineId: e.airline_id ? String(e.airline_id) : "",
    amount: String(Number(e.amount)),
    notes: e.notes || "",
    installments: e.installments.map((i) => ({
      key: `db-${i.id}`,
      dueDate: String(i.due_date).slice(0, 10),
      amount: String(Number(i.amount)),
      paidDate: i.paid_date ? String(i.paid_date).slice(0, 10) : "",
      paymentMethod: i.payment_method || "",
      reference: i.reference || "",
    })),
  };
}

// Liste proposée + l'élément déjà choisi (édition d'une charge dont l'hôtel ou
// la compagnie n'est plus affecté au programme : il reste sélectionné).
function withCurrent(list, all, currentId) {
  if (!currentId || list.some((x) => String(x.id) === String(currentId))) return list;
  const current = all.find((x) => String(x.id) === String(currentId));
  return current ? [...list, current] : list;
}

let keySeq = 0;
const newKey = () => `new-${Date.now()}-${keySeq++}`;

function addMonths(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return localIso(d);
}

export default function ExpensesCard({ tripId, expenses, hotels, airlines, allHotels = [], allAirlines = [], canManage }) {
  const router = useRouter();
  const { tr } = useAdminLocale();
  // Montant affiché avec la devise traduite (MAD / درهم).
  const mad = (value) => `${formatMoney(value)} ${tr("MAD")}`;
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = useState(null); // null | "new" | expense id
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyInstallment, setBusyInstallment] = useState(null);

  const summary = summarizeExpenses(expenses);
  const today = todayIso();

  const startNew = () => {
    setForm(emptyForm());
    setEditing("new");
    setError(null);
  };
  const startEdit = (expense) => {
    setForm(formFromExpense(expense));
    setEditing(expense.id);
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setError(null);
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setInstallment = (key, field, value) =>
    setForm((f) => ({
      ...f,
      installments: f.installments.map((i) => (i.key === key ? { ...i, [field]: value } : i)),
    }));
  const removeInstallment = (key) =>
    setForm((f) => ({ ...f, installments: f.installments.filter((i) => i.key !== key) }));

  const scheduled = form.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const unscheduled = Math.round(((Number(form.amount) || 0) - scheduled) * 100) / 100;

  const addInstallment = () =>
    setForm((f) => ({
      ...f,
      installments: [
        ...f.installments,
        { key: newKey(), dueDate: today, amount: unscheduled > 0 ? String(unscheduled) : "", paidDate: "", paymentMethod: "", reference: "" },
      ],
    }));

  // Répartit le montant total en N échéances égales, mensuelles à partir
  // d'aujourd'hui (la dernière absorbe l'arrondi) — remplace l'échéancier.
  const splitInto = (n) => {
    const total = Number(form.amount) || 0;
    if (!(total > 0)) {
      setError("Saisissez d'abord le montant total");
      return;
    }
    const part = Math.floor((total / n) * 100) / 100;
    const list = Array.from({ length: n }, (_, idx) => ({
      key: newKey(),
      dueDate: addMonths(today, idx),
      amount: String(idx === n - 1 ? Math.round((total - part * (n - 1)) * 100) / 100 : part),
      paidDate: "",
      paymentMethod: "",
      reference: "",
    }));
    setError(null);
    setForm((f) => ({ ...f, installments: list }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      category: form.category,
      label: form.label,
      supplier: form.supplier,
      hotelId: form.category === "hotel" ? form.hotelId || null : null,
      airlineId: form.category === "billets" ? form.airlineId || null : null,
      amount: form.amount,
      notes: form.notes,
      installments: form.installments.map((i) => ({
        dueDate: i.dueDate,
        amount: i.amount,
        paidDate: i.paidDate || null,
        paymentMethod: i.paidDate ? i.paymentMethod : null,
        reference: i.paidDate ? i.reference : null,
      })),
    };
    try {
      const res = await fetch(
        editing === "new" ? `/api/admin/trips/${tripId}/expenses` : `/api/admin/trip-expenses/${editing}`,
        { method: editing === "new" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Enregistrement impossible");
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense) => {
    const name = expense.label || expense.hotel_name || expense.airline_name || EXPENSE_CATEGORY_META[expense.category].label;
    if (!(await confirm(tr("Supprimer la charge « {label} » et son échéancier ?", { label: name })))) return;
    const res = await fetch(`/api/admin/trip-expenses/${expense.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Suppression impossible");
      return;
    }
    router.refresh();
  };

  const togglePaid = async (installment) => {
    setBusyInstallment(installment.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/trip-expense-installments/${installment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installment.paid_date ? { paidDate: null } : { paidDate: today }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Mise à jour impossible");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyInstallment(null);
    }
  };

  const byCategory = Object.keys(EXPENSE_CATEGORY_META)
    .map((cat) => ({ cat, items: expenses.filter((e) => e.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="gf-stat">
          <span className="gf-stat-label">Total des charges</span>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{mad(summary.total)}</span>
        </div>
        <div className="gf-stat" style={{ background: "color-mix(in oklch, var(--gf-accent) 8%, #fff)" }}>
          <span className="gf-stat-label">Payé</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: "var(--gf-accent)" }}>{mad(summary.paid)}</span>
        </div>
        <div className="gf-stat" style={{ background: summary.remaining > 0 ? "#fff8eb" : "#f8f8f6" }}>
          <span className="gf-stat-label">Reste à payer</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: summary.remaining > 0 ? "#a35a00" : "var(--gf-text)" }}>
            {mad(summary.remaining)}
          </span>
        </div>
        <div className="gf-stat" style={{ background: summary.overdue > 0 ? "#fdf1f1" : "#f8f8f6" }}>
          <span className="gf-stat-label">{summary.overdue > 0 ? "En retard" : "Prochaine échéance"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: summary.overdue > 0 ? "#c4373b" : "var(--gf-text)" }}>
            {summary.overdue > 0
              ? mad(summary.overdue)
              : summary.nextDue
              ? `${fmtDate(summary.nextDue.date)} · ${mad(summary.nextDue.amount)}`
              : "—"}
          </span>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Liste par catégorie */}
      {byCategory.length === 0 && editing === null && (
        <div className="gf-empty" style={{ padding: "24px 12px" }}>
          <Icon name="receipt_long" />
          Aucune charge enregistrée pour ce voyage.
        </div>
      )}

      {byCategory.map(({ cat, items }) => {
        const meta = EXPENSE_CATEGORY_META[cat];
        const catTotal = items.reduce((s, e) => s + Number(e.amount), 0);
        return (
          <div key={cat} className="flex flex-col gap-2">
            <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600 }}>
              <span className="gf-kpi-icon" style={{ width: 26, height: 26, background: meta.soft, color: meta.tone }}>
                <Icon name={meta.icon} size={16} />
              </span>
              {meta.label}
              <span className="ms-auto" style={{ fontWeight: 500, color: "var(--gf-muted)" }}>
                {mad(catTotal)}
              </span>
            </div>

            {items.map((expense) => {
              const paid = expense.installments.filter((i) => installmentState(i, today) === "paid").reduce((s, i) => s + Number(i.amount), 0);
              const planned = expense.installments.reduce((s, i) => s + Number(i.amount), 0);
              const notPlanned = Number(expense.amount) - planned;
              const pct = Math.min(100, (paid / Number(expense.amount)) * 100);
              return (
                <div key={expense.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {expense.label || expense.hotel_name || expense.airline_name || meta.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
                        {[expense.hotel_name, expense.airline_name, expense.supplier].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="text-end">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{mad(expense.amount)}</div>
                      <div style={{ fontSize: 12, color: "var(--gf-muted)" }}>{tr("Payé : {amount}", { amount: mad(paid) })}</div>
                    </div>
                    {canManage && (
                      <div className="flex">
                        <button type="button" className="gf-btn-icon" title="Modifier" onClick={() => startEdit(expense)}>
                          <Icon name="edit" size={17} />
                        </button>
                        <button type="button" className="gf-btn-icon gf-danger" title="Supprimer" onClick={() => handleDelete(expense)}>
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="gf-progress mt-2" style={{ height: 6 }}>
                    <div style={{ width: `${pct}%`, background: "var(--gf-accent)" }} />
                  </div>

                  {expense.installments.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {expense.installments.map((i, idx) => {
                        const due = String(i.due_date).slice(0, 10);
                        const state = installmentState(i, today);
                        return (
                          <li
                            key={i.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5"
                            style={{ background: "#fafaf9", fontSize: 12.5 }}
                          >
                            <span style={{ color: "var(--gf-subtle)", width: 22 }}>{idx + 1}.</span>
                            <Icon name="event" size={15} style={{ color: "var(--gf-subtle)" }} />
                            <span style={{ minWidth: 80 }}>{fmtDate(due)}</span>
                            <span style={{ fontWeight: 600, minWidth: 90 }}>{mad(i.amount)}</span>
                            {state === "paid" ? (
                              <span className="gf-pill" style={{ background: "#e6f4ee", color: "#0f6b4b" }}>
                                {tr("Payé le {date}", { date: fmtDate(i.paid_date) })}
                              </span>
                            ) : state === "in_progress" ? (
                              <span className="gf-pill" style={{ background: "#e8f0fd", color: "#2b5cc4" }}>
                                {tr("Paiement en cours · prévu le {date}", { date: fmtDate(i.paid_date) })}
                              </span>
                            ) : state === "late" ? (
                              <span className="gf-pill" style={{ background: "#fdecec", color: "#c4373b" }}>
                                En retard
                              </span>
                            ) : (
                              <span className="gf-pill" style={{ background: "#fff4e0", color: "#a35a00" }}>
                                À payer
                              </span>
                            )}
                            {i.payment_method && (
                              <span style={{ color: "var(--gf-muted)" }}>{METHOD_LABELS[i.payment_method] || i.payment_method}</span>
                            )}
                            {i.reference && (
                              <span className="gf-mono" style={{ color: "var(--gf-muted)" }} translate="no">
                                {i.reference}
                              </span>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                disabled={busyInstallment === i.id}
                                onClick={() => togglePaid(i)}
                                className="ms-auto rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                {i.paid_date ? "Annuler le paiement" : "Marquer payé"}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {notPlanned > 0.005 && (
                    <p className="mt-2" style={{ fontSize: 12, color: "#a35a00" }}>
                      {tr("Non planifié : {amount}", { amount: mad(notPlanned) })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Formulaire ajout / modification */}
      {canManage && editing === null && (
        <button type="button" onClick={startNew} className="gf-btn-primary self-start">
          <Icon name="add" size={18} />
          Ajouter une charge
        </button>
      )}

      {canManage && editing !== null && (
        <form onSubmit={handleSave} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {editing === "new" ? "Nouvelle charge" : "Modifier la charge"}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Catégorie
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                {Object.entries(EXPENSE_CATEGORY_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Libellé (facultatif)
              <input
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="ex. Réservation 10 chambres quadruples"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            {form.category === "hotel" && (
              <label className="text-sm font-medium">
                Hôtel
                <select
                  value={form.hotelId}
                  onChange={(e) => set("hotelId", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Aucun —</option>
                  {withCurrent(hotels, allHotels, form.hotelId).map((h) => (
                    <option key={h.id} value={h.id} translate="no">
                      {h.display_name || h.name}
                      {h.city ? ` (${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.category === "billets" && (
              <label className="text-sm font-medium">
                Compagnie aérienne
                <select
                  value={form.airlineId}
                  onChange={(e) => set("airlineId", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Aucune —</option>
                  {withCurrent(airlines, allAirlines, form.airlineId).map((a) => (
                    <option key={a.id} value={a.id} translate="no">
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm font-medium">
              Fournisseur / bénéficiaire
              <input
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="ex. Agence réceptive, nom du guide…"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Montant total (MAD)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {/* Échéancier */}
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Échéancier de paiement</span>
              <span className="ms-auto flex flex-wrap gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => splitInto(n)} className="gf-btn-outline" style={{ height: 28 }}>
                    {n === 1 ? "Paiement unique" : tr("Répartir en {n}", { n })}
                  </button>
                ))}
              </span>
            </div>

            {form.installments.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--gf-muted)" }}>
                Aucune échéance : ajoutez une ou plusieurs dates de paiement.
              </p>
            )}

            {form.installments.map((i, idx) => (
              <div key={i.key} className="grid items-end gap-2 sm:grid-cols-[24px_1fr_1fr_1fr_auto]">
                <span style={{ fontSize: 12.5, color: "var(--gf-subtle)", paddingBottom: 8 }}>{idx + 1}.</span>
                <label className="text-xs font-medium">
                  Date prévue
                  <input
                    type="date"
                    required
                    value={i.dueDate}
                    onChange={(e) => setInstallment(i.key, "dueDate", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Montant (MAD)
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={i.amount}
                    onChange={(e) => setInstallment(i.key, "amount", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Date de paiement (vide = à payer)
                  <input
                    type="date"
                    value={i.paidDate}
                    onChange={(e) => setInstallment(i.key, "paidDate", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button type="button" className="gf-btn-icon gf-danger" title="Retirer" onClick={() => removeInstallment(i.key)}>
                  <Icon name="delete" size={17} />
                </button>
                {i.paidDate && (
                  <div className="grid gap-2 sm:col-span-5 sm:grid-cols-2 sm:ps-8">
                    <select
                      value={i.paymentMethod}
                      onChange={(e) => setInstallment(i.key, "paymentMethod", e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Mode de paiement…</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={i.reference}
                      onChange={(e) => setInstallment(i.key, "reference", e.target.value)}
                      placeholder="Référence (n° virement, facture…)"
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={addInstallment} className="gf-btn-outline" style={{ height: 30 }}>
                <Icon name="add" size={16} />
                Ajouter une échéance
              </button>
              <span className="ms-auto" style={{ fontSize: 12.5, color: unscheduled < -0.005 ? "#c4373b" : "var(--gf-muted)" }}>
                {unscheduled < -0.005
                  ? tr("Dépassement : {amount}", { amount: mad(-unscheduled) })
                  : tr("Planifié : {a} · Non planifié : {b}", { a: mad(scheduled), b: mad(unscheduled) })}
              </span>
            </div>
          </div>

          <label className="text-sm font-medium">
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} className="gf-btn-outline" style={{ height: 36 }}>
              Annuler
            </button>
            <button type="submit" disabled={saving} className="gf-btn-primary disabled:opacity-60" style={{ height: 36 }}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {confirmDialog}
    </div>
  );
}
