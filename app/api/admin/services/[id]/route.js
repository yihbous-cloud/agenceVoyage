import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { updateService, deleteService } from "@/lib/services";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "comptabilite"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { name, defaultPrice } = await request.json();
  await updateService(id, { name, defaultPrice });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "comptabilite"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteService(id);
  return NextResponse.json({ ok: true });
}
