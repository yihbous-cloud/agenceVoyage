import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllSlides, createSlide } from "@/lib/slides";

export async function GET() {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const slides = await listAllSlides();
  return NextResponse.json(slides);
}

export async function POST(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

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

  const id = await createSlide(body);
  return NextResponse.json({ id }, { status: 201 });
}
