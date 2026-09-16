import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { removeRegistrationService } from "@/lib/services";

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.services"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await removeRegistrationService(id);
  return NextResponse.json({ ok: true });
}
