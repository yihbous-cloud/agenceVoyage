import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { deletePayment } from "@/lib/payments";
import { withNotFound } from "@/lib/apiGuard";

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "paiements.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deletePayment(id);
  return NextResponse.json({ ok: true });
}

export const DELETE = withNotFound(DELETE_handler);
