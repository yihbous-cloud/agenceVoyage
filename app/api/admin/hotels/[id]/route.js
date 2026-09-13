import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { updateHotel, deleteHotel } from "@/lib/hotels";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  await updateHotel(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteHotel(id);
  return NextResponse.json({ ok: true });
}
