import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllPrograms, createProgram, slugify } from "@/lib/programsAdmin";
import { setDefaultHotelsForProgram } from "@/lib/programHotels";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const programs = await listAllPrograms();
  return NextResponse.json(programs);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }
  if (!["omra_hajj", "voyage_organise"].includes(body.family)) {
    return NextResponse.json(
      { message: "La famille (Omra & Hajj / Voyages organisés) est requise" },
      { status: 400 }
    );
  }

  try {
    const id = await createProgram({
      ...body,
      slug: body.slug?.trim() || slugify(body.title),
    });
    if (Array.isArray(body.defaultHotelIds)) {
      await setDefaultHotelsForProgram(id, body.defaultHotelIds);
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Ce slug existe déjà, choisissez-en un autre" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
