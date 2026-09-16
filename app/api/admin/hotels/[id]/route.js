import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateHotel, deleteHotel } from "@/lib/hotels";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hotels.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  await updateHotel(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hotels.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteHotel(id);
  return NextResponse.json({ ok: true });
}
