import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { updateProgram, deleteProgram, slugify } from "@/lib/programsAdmin";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.title) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }

  try {
    await updateProgram(id, {
      ...body,
      slug: body.slug?.trim() || slugify(body.title),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
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

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteProgram(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return NextResponse.json(
        { message: "Impossible de supprimer : ce programme a des voyages associés" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
