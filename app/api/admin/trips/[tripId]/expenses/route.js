import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listExpensesForTrip, createExpense } from "@/lib/tripExpenses";
import { withNotFound } from "@/lib/apiGuard";

// Charges financières d'un voyage (migration 035) — lecture : charges.view,
// écriture : charges.manage.
async function GET_handler(request, { params }) {
  const session = await getSession();
  const allowed =
    (await hasPermission(session, "charges.view")) || (await hasPermission(session, "charges.manage"));
  if (!allowed) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { tripId } = await params;
  return NextResponse.json(await listExpensesForTrip(tripId));
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "charges.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { tripId } = await params;
  const body = await request.json();
  try {
    const id = await createExpense(tripId, body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
