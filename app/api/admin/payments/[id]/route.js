import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { deletePayment } from "@/lib/payments";

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "comptabilite"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deletePayment(id);
  return NextResponse.json({ ok: true });
}
