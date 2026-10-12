import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateMealOffer, deleteMealOffer } from "@/lib/tripMealOffers";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages, findProgramIds } from "@/lib/publicRevalidation";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }

  await updateMealOffer(id, body);
  await refreshPublicPages({ mealOfferId: id });
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const programIds = await findProgramIds({ mealOfferId: id });
  await deleteMealOffer(id);
  await refreshPublicPages({ programIds });
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
