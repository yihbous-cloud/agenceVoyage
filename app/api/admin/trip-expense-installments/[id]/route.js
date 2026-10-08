import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setInstallmentPaid } from "@/lib/tripExpenses";
import { withNotFound } from "@/lib/apiGuard";

// Marque une échéance payée ({ paidDate, paymentMethod, reference }) ou la
// repasse à payer ({ paidDate: null }).
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "charges.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    await setInstallmentPaid(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

export const PUT = withNotFound(PUT_handler);
