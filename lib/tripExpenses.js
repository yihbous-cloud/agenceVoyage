import { query, getPool } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";

// Charges financières d'un voyage (coûts supportés par l'agence) : hôtels,
// billets, équipe/guide, accessoires/cadeaux, autres — chacune payable en une
// ou plusieurs échéances datées (migration 035, voir CLAUDE.md).

export const EXPENSE_CATEGORIES = ["hotel", "billets", "equipe", "accessoires", "autre"];

function toAmount(value) {
  const n = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(n) ? n : NaN;
}

// Normalise et valide une charge (lève une erreur INVALID au message lisible).
export function normalizeExpense(data) {
  const fail = (message) => {
    const err = new Error(message);
    err.code = "INVALID";
    throw err;
  };
  if (!EXPENSE_CATEGORIES.includes(data.category)) fail("Catégorie de charge invalide");
  const amount = toAmount(data.amount);
  if (!(amount > 0)) fail("Le montant total doit être supérieur à 0");

  const installments = (data.installments || []).map((i) => ({
    dueDate: i.dueDate,
    amount: toAmount(i.amount),
    paidDate: i.paidDate || null,
    paymentMethod: i.paymentMethod?.trim() || null,
    reference: i.reference?.trim() || null,
  }));
  for (const i of installments) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate || "")) fail("Chaque échéance doit avoir une date");
    if (!(i.amount > 0)) fail("Chaque échéance doit avoir un montant supérieur à 0");
    if (i.paidDate && !/^\d{4}-\d{2}-\d{2}$/.test(i.paidDate)) fail("Date de paiement invalide");
  }
  const scheduled = installments.reduce((s, i) => s + i.amount, 0);
  if (scheduled - amount > 0.005) fail("Le total des échéances dépasse le montant de la charge");

  return {
    category: data.category,
    // Libellé facultatif : vide = l'interface affiche l'hôtel, la compagnie
    // ou la catégorie à la place.
    label: data.label?.trim() || "",
    supplier: data.supplier?.trim() || null,
    hotelId: data.category === "hotel" && data.hotelId ? data.hotelId : null,
    airlineId: data.category === "billets" && data.airlineId ? data.airlineId : null,
    amount,
    notes: data.notes?.trim() || null,
    installments: installments.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  };
}

export async function listExpensesForTrip(tripId) {
  const agencyId = await resolveAgencyId();
  const expenses = await query(
    `SELECT e.*, h.name AS hotel_name, a.name AS airline_name
     FROM trip_expenses e
     LEFT JOIN hotels h ON h.id = e.hotel_id AND h.agency_id = e.agency_id
     LEFT JOIN airlines a ON a.id = e.airline_id AND a.agency_id = e.agency_id
     WHERE e.trip_id = ? AND e.agency_id = ?
     ORDER BY FIELD(e.category, 'hotel', 'billets', 'equipe', 'accessoires', 'autre'), e.id`,
    [tripId, agencyId]
  );
  if (expenses.length === 0) return [];

  const ids = expenses.map((e) => e.id);
  const installments = await query(
    `SELECT * FROM trip_expense_installments
     WHERE agency_id = ? AND expense_id IN (${ids.map(() => "?").join(",")})
     ORDER BY due_date ASC, id ASC`,
    [agencyId, ...ids]
  );
  return expenses.map((e) => ({
    ...e,
    installments: installments.filter((i) => i.expense_id === e.id),
  }));
}

async function insertInstallments(connection, expenseId, installments, agencyId) {
  for (const i of installments) {
    await connection.execute(
      `INSERT INTO trip_expense_installments
         (expense_id, due_date, amount, paid_date, payment_method, reference, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expenseId, i.dueDate, i.amount, i.paidDate, i.paymentMethod, i.reference, agencyId]
    );
  }
}

async function assertReferences(data, agencyId) {
  if (data.hotelId) await assertOwned("hotels", data.hotelId, agencyId);
  if (data.airlineId) await assertOwned("airlines", data.airlineId, agencyId);
}

export async function createExpense(tripId, rawData) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trips", tripId, agencyId);
  const data = normalizeExpense(rawData);
  await assertReferences(data, agencyId);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trip_expenses (trip_id, category, label, supplier, hotel_id, airline_id, amount, notes, agency_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tripId, data.category, data.label, data.supplier, data.hotelId, data.airlineId, data.amount, data.notes, agencyId]
    );
    await insertInstallments(connection, result.insertId, data.installments, agencyId);
    await connection.commit();
    return result.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Remplacement complet (charge + échéancier, purge + réinsertion — même
// compromis que setRolePermissions) : le client renvoie toujours la liste
// complète des échéances, y compris celles déjà payées.
export async function updateExpense(id, rawData) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_expenses", id, agencyId);
  const data = normalizeExpense(rawData);
  await assertReferences(data, agencyId);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE trip_expenses SET category = ?, label = ?, supplier = ?, hotel_id = ?, airline_id = ?, amount = ?, notes = ?
       WHERE id = ? AND agency_id = ?`,
      [data.category, data.label, data.supplier, data.hotelId, data.airlineId, data.amount, data.notes, id, agencyId]
    );
    await connection.execute(
      `DELETE FROM trip_expense_installments WHERE expense_id = ? AND agency_id = ?`,
      [id, agencyId]
    );
    await insertInstallments(connection, id, data.installments, agencyId);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function deleteExpense(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_expenses", id, agencyId);
  await query(`DELETE FROM trip_expenses WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// Marque une échéance payée (paidDate renseignée) ou la repasse "à payer".
export async function setInstallmentPaid(id, { paidDate, paymentMethod, reference }) {
  const agencyId = await resolveAgencyId();
  await assertOwned("trip_expense_installments", id, agencyId);
  if (paidDate && !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    const err = new Error("Date de paiement invalide");
    err.code = "INVALID";
    throw err;
  }
  await query(
    `UPDATE trip_expense_installments SET paid_date = ?, payment_method = ?, reference = ?
     WHERE id = ? AND agency_id = ?`,
    [paidDate || null, paidDate ? paymentMethod?.trim() || null : null, paidDate ? reference?.trim() || null : null, id, agencyId]
  );
}

// Page Finances : toutes les charges de l'agence avec leur voyage/programme
// et leur échéancier (deux requêtes, aucun N+1).
export async function listAllExpensesWithInstallments() {
  const agencyId = await resolveAgencyId();
  const expenses = await query(
    `SELECT e.*, h.name AS hotel_name, a.name AS airline_name,
            t.reference_code, t.departure_date, p.id AS program_id, p.title AS program_title
     FROM trip_expenses e
     JOIN trips t ON t.id = e.trip_id AND t.agency_id = e.agency_id
     JOIN programs p ON p.id = t.program_id AND p.agency_id = e.agency_id
     LEFT JOIN hotels h ON h.id = e.hotel_id AND h.agency_id = e.agency_id
     LEFT JOIN airlines a ON a.id = e.airline_id AND a.agency_id = e.agency_id
     WHERE e.agency_id = ?
     ORDER BY t.departure_date ASC, e.id ASC`,
    [agencyId]
  );
  if (expenses.length === 0) return [];
  const installments = await query(
    `SELECT * FROM trip_expense_installments WHERE agency_id = ? ORDER BY due_date ASC, id ASC`,
    [agencyId]
  );
  return expenses.map((e) => ({
    ...e,
    installments: installments.filter((i) => i.expense_id === e.id),
  }));
}
