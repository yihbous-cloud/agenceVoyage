import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTiersForTrip, createTier } from "@/lib/tripHotelTiers";
import { getTripSummary } from "@/lib/roomAssignment";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { tripId } = await params;
  const tiers = await listTiersForTrip(tripId);
  return NextResponse.json(tiers);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "voyages.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const body = await request.json();

  const trip = await getTripSummary(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }
  if (trip.program_family !== "omra_hajj") {
    return NextResponse.json(
      { message: "Les tarifs d'hébergement ne sont disponibles que pour les voyages Omra/Hajj" },
      { status: 400 }
    );
  }
  if (!body.label?.trim() || !body.makkahHotelId || !body.madinahHotelId) {
    return NextResponse.json(
      { message: "Le nom du tarif et les deux hôtels sont requis" },
      { status: 400 }
    );
  }

  const tierId = await createTier(tripId, body);
  return NextResponse.json({ id: tierId }, { status: 201 });
}
