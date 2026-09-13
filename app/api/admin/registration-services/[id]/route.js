import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { removeRegistrationService } from "@/lib/services";

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "ventes"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await removeRegistrationService(id);
  return NextResponse.json({ ok: true });
}
