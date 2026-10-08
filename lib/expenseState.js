// Logique pure (aucun import) des charges financières : catégories, état
// d'une échéance, totaux — partagée par la carte de la fiche programme
// (composant client) et la page Finances (serveur). Migration 035.

export const EXPENSE_CATEGORY_META = {
  hotel: { label: "Hôtels", icon: "hotel", tone: "#2b5cc4", soft: "#e8f0fd" },
  billets: { label: "Billets d'avion", icon: "flight", tone: "#6b3fc4", soft: "#efe9fb" },
  equipe: { label: "Équipe / guide", icon: "groups", tone: "#0f6b4b", soft: "#e6f4ee" },
  accessoires: { label: "Accessoires / cadeaux", icon: "redeem", tone: "#a35a00", soft: "#fff4e0" },
  autre: { label: "Autres charges", icon: "receipt_long", tone: "#5a5a60", soft: "#f1f1ee" },
};

// Date locale AAAA-MM-JJ (toISOString donnerait la date UTC, la veille en soirée).
export const localIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => localIso(new Date());

// Échéance réellement payée : date de paiement renseignée ET déjà passée.
// Une date de paiement dans le futur = paiement programmé, « en cours » —
// ni payé, ni en retard.
export function installmentState(i, today = todayIso()) {
  const paidDate = i.paid_date ? String(i.paid_date).slice(0, 10) : null;
  if (paidDate && paidDate <= today) return "paid";
  if (paidDate) return "in_progress";
  return String(i.due_date).slice(0, 10) < today ? "late" : "todo";
}

// Totaux d'une liste de charges (chacune avec ses `installments`).
export function summarizeExpenses(expenses) {
  let total = 0;
  let paid = 0;
  let overdue = 0;
  let nextDue = null;
  const today = todayIso();
  for (const e of expenses) {
    total += Number(e.amount);
    for (const i of e.installments || []) {
      const due = String(i.due_date).slice(0, 10);
      const state = installmentState(i, today);
      if (state === "paid") paid += Number(i.amount);
      else {
        if (state === "late") overdue += Number(i.amount);
        if (!nextDue || due < nextDue.date) nextDue = { date: due, amount: Number(i.amount) };
      }
    }
  }
  return { total, paid, remaining: total - paid, overdue, nextDue };
}
