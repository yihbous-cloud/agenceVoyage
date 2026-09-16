import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setContactMessageStatus, deleteContactMessage } from "@/lib/contactMessages";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "messages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!["nouveau", "traite"].includes(status)) {
    return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
  }

  await setContactMessageStatus(id, status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "messages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteContactMessage(id);
  return NextResponse.json({ ok: true });
}
