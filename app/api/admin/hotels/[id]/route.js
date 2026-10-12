import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateHotel, deleteHotel } from "@/lib/hotels";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages, findProgramIds } from "@/lib/publicRevalidation";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hotels.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  await updateHotel(id, body);
  // Nom, nom arabe, distance... affichés sur de nombreuses fiches.
  await refreshPublicPages({ site: true });
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hotels.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteHotel(id);
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
