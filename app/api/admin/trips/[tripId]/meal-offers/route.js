import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllMealOffersForTrip, createMealOffer } from "@/lib/tripMealOffers";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { tripId } = await params;
  const offers = await listAllMealOffersForTrip(tripId);
  return NextResponse.json(offers);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const body = await request.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }

  const offerId = await createMealOffer(tripId, body);
  return NextResponse.json({ id: offerId }, { status: 201 });
}
