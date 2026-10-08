import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { assignRegistrationsToRoom, unassignRegistrationFromTrip } from "@/lib/roomAssignment";
import { withNotFound } from "@/lib/apiGuard";

// `registrationIds` (optionnel) : transfert de plusieurs inscriptions d'un
// coup (groupe entier) vers la même chambre, en une seule transaction. Sans
// lui, seule l'inscription de l'URL est affectée/transférée.
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { roomId, registrationIds } = await request.json();

  if (!roomId) {
    return NextResponse.json({ message: "roomId est requis" }, { status: 400 });
  }

  const ids =
    Array.isArray(registrationIds) && registrationIds.length > 0
      ? [...new Set([...registrationIds, id].map(Number))]
      : [Number(id)];

  try {
    await assignRegistrationsToRoom(ids, roomId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

// Désaffecte le voyageur de TOUTES les villes du voyage (pas seulement une
// chambre précise) — voir le commentaire de unassignRegistrationFromTrip,
// lib/roomAssignment.js.
async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await unassignRegistrationFromTrip(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
