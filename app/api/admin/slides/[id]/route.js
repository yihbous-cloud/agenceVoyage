import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateSlide, deleteSlide } from "@/lib/slides";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }
  if (!body.programId && !body.buttonLink?.trim()) {
    return NextResponse.json(
      { message: "Choisir un programme ou renseigner un lien personnalisé" },
      { status: 400 }
    );
  }

  await updateSlide(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteSlide(id);
  return NextResponse.json({ ok: true });
}
