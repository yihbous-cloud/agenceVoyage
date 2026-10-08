import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateTier, deleteTier } from "@/lib/tripHotelTiers";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.label?.trim() || !body.makkahHotelId || !body.madinahHotelId) {
    return NextResponse.json(
      { message: "Le nom du tarif et les deux hôtels sont requis" },
      { status: 400 }
    );
  }

  await updateTier(id, body);
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteTier(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        { message: "Ce tarif est encore utilisé par au moins une inscription" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
