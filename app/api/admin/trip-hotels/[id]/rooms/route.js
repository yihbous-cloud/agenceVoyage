import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { createRoom } from "@/lib/roomAssignment";

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.roomType || !body.capacity) {
    return NextResponse.json(
      { message: "roomType et capacity sont requis" },
      { status: 400 }
    );
  }

  const roomId = await createRoom(id, body);
  return NextResponse.json({ id: roomId }, { status: 201 });
}
