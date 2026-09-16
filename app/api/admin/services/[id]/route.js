import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateService, deleteService } from "@/lib/services";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { name, defaultPrice } = await request.json();
  await updateService(id, { name, defaultPrice });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteService(id);
  return NextResponse.json({ ok: true });
}
