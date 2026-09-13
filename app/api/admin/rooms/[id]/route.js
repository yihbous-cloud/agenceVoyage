import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { deleteRoom } from "@/lib/roomAssignment";

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteRoom(id);
  return NextResponse.json({ ok: true });
}
