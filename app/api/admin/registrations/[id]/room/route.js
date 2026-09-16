import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { assignRegistrationToRoom, unassignRegistration } from "@/lib/roomAssignment";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
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
