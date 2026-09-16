import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { moveSlide } from "@/lib/slides";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { direction } = await request.json();
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ message: "Direction invalide" }, { status: 400 });
  }

  await moveSlide(id, direction);
  return NextResponse.json({ ok: true });
}
