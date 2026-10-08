import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateSlide, deleteSlide } from "@/lib/slides";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  // Tous les champs (titre, sous-titre, lien) sont optionnels — une
  // diapositive peut n'avoir qu'une image (CLAUDE.md).

  await updateSlide(id, body);
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteSlide(id);
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
