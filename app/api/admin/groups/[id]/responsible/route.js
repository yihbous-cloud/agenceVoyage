import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateGroupResponsible, getGroupMembers } from "@/lib/registrationGroups";
import { withNotFound } from "@/lib/apiGuard";

// Désignation manuelle du responsable/point de contact d'un groupe (le
// premier membre inscrit le devient automatiquement à la création, voir
// lib/registrationGroups.js::ensureGroupResponsible et CLAUDE.md) — même
// permission que la création/modification d'un groupe, pas le volet
// financier (paiements.manage), qui a son propre endpoint dédié.
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.edit"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { responsibleRegistrationId } = await request.json();

  if (responsibleRegistrationId) {
    const members = await getGroupMembers(id);
    const isMember = members.some((m) => String(m.id) === String(responsibleRegistrationId));
    if (!isMember) {
      return NextResponse.json(
        { message: "Le responsable doit être un membre actuel du groupe" },
        { status: 400 }
      );
    }
  }

  const updated = await updateGroupResponsible(id, responsibleRegistrationId || null);
  return NextResponse.json(updated);
}

export const PUT = withNotFound(PUT_handler);
