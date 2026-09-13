import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { assignRegistrationToRoom, unassignRegistration } from "@/lib/roomAssignment";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { roomId } = await request.json();

  try {
    if (roomId) {
      await assignRegistrationToRoom(id, roomId);
    } else {
      await unassignRegistration(id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
