import Link from "next/link";
import {
  getFinancialSummaryByTrip,
  getFinancialSummaryByProgram,
  getPaymentsByPeriod,
} from "@/lib/payments";
import { getSession } from "@/lib/session";
import PeriodFilter from "./PeriodFilter";

function money(n) {
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

export default async function FinancesPage({ searchParams }) {
  const session = await getSession();
  if (!["direction", "comptabilite"].includes(session?.role)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Accès réservé à la direction et à la comptabilité.
      </div>
    );
  }

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = params?.start || today.slice(0, 8) + "01";
  const endDate = params?.end || today;

  const [byTrip, byProgram, periodPayments] = await Promise.all([
    getFinancialSummaryByTrip(),
    getFinancialSummaryByProgram(),
    getPaymentsByPeriod(startDate, endDate),
  ]);

  const periodTotal = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Finances</h1>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Par voyage</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Inscrits</th>
                <th className="px-4 py-3">Dû</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Solde</th>
              </tr>
            </thead>
            <tbody>
              {byTrip.map((t) => (
                <tr key={t.trip_id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">{t.program_title}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/inscriptions?tripId=${t.trip_id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {t.reference_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(t.departure_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">{t.registrations_count}</td>
                  <td className="px-4 py-3">{money(t.total_due)} MAD</td>
                  <td className="px-4 py-3 text-emerald-700">{money(t.total_paid)} MAD</td>
                  <td className={`px-4 py-3 ${t.balance_due > 0 ? "text-red-600" : ""}`}>
                    {money(t.balance_due)} MAD
                  </td>
                </tr>
              ))}
              {byTrip.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                    Aucun voyage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Par programme</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Inscrits</th>
                <th className="px-4 py-3">Dû</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Solde</th>
              </tr>
            </thead>
            <tbody>
              {byProgram.map((p) => (
                <tr key={p.program_id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">{p.program_title}</td>
                  <td className="px-4 py-3">{p.registrations_count}</td>
                  <td className="px-4 py-3">{money(p.total_due)} MAD</td>
                  <td className="px-4 py-3 text-emerald-700">{money(p.total_paid)} MAD</td>
                  <td className={`px-4 py-3 ${p.balance_due > 0 ? "text-red-600" : ""}`}>
                    {money(p.balance_due)} MAD
                  </td>
                </tr>
              ))}
              {byProgram.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={5}>
                    Aucun programme.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Paiements par période
          </h2>
          <PeriodFilter start={startDate} end={endDate} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voyageur</th>
                <th className="px-4 py-3">Programme / Voyage</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Montant</th>
              </tr>
            </thead>
            <tbody>
              {periodPayments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    {new Date(p.payment_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">{p.full_name}</td>
                  <td className="px-4 py-3">
                    {p.program_title} — {p.reference_code}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                  <td className="px-4 py-3">{p.receipt_reference || "—"}</td>
                  <td className="px-4 py-3 font-medium">{p.amount} {p.currency}</td>
                </tr>
              ))}
              {periodPayments.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-500" colSpan={6}>
                    Aucun paiement sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
            {periodPayments.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>
                    Total
                  </td>
                  <td className="px-4 py-3">{money(periodTotal)} MAD</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
