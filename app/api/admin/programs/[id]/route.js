import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateProgram, deleteProgram, slugify, getProgramById } from "@/lib/programsAdmin";
import { setDefaultHotelsForProgram } from "@/lib/programHotels";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Mise à jour partielle : une carte (Informations, Affichage, Hôtels...)
  // n'envoie que ses propres champs — on ne rend un champ requis que quand
  // il fait partie de cet envoi précis (voir CLAUDE.md).
  if (body.title !== undefined && !body.title) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }
  if (body.family !== undefined && !["omra_hajj", "voyage_organise"].includes(body.family)) {
    return NextResponse.json(
      { message: "La famille (Omra & Hajj / Voyages organisés) est requise" },
      { status: 400 }
    );
  }

  try {
    const payload = { ...body };
    if (body.slug !== undefined) {
      const trimmed = body.slug?.trim();
      if (trimmed) {
        payload.slug = trimmed;
      } else {
        const title = body.title !== undefined ? body.title : (await getProgramById(id))?.title;
        payload.slug = slugify(title || "");
      }
    }
    await updateProgram(id, payload);
    if (Array.isArray(body.defaultHotelIds)) {
      await setDefaultHotelsForProgram(id, body.defaultHotelIds);
    }
    return NextResponse.json({ ok: true });
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

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteProgram(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "PROGRAM_HAS_REGISTRATIONS") {
      return NextResponse.json(
        { message: "Impossible de supprimer : des voyageurs sont inscrits à ce programme" },
        { status: 409 }
      );
    }
    // Filet de sécurité : si une dépendance non prévue bloque malgré tout
    // (contrainte de clé étrangère non nettoyée par deleteProgram), la
    // transaction a déjà été annulée (rollback) — rien n'est perdu.
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return NextResponse.json(
        { message: "Impossible de supprimer : ce programme a des données associées" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
