import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateTier, deleteTier } from "@/lib/tripHotelTiers";

export async function PUT(request, { params }) {
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

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteTier(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        { message: "Ce tarif est encore utilisé par au moins une inscription" },
        { status: 409 }
      );
    }
    throw err;
  }
}
