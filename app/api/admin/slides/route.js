import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllSlides, createSlide } from "@/lib/slides";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const slides = await listAllSlides();
  return NextResponse.json(slides);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  // Tous les champs (titre, sous-titre, lien) sont optionnels — une
  // diapositive peut n'avoir qu'une image (CLAUDE.md).

  const id = await createSlide(body);
  return NextResponse.json({ id }, { status: 201 });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
