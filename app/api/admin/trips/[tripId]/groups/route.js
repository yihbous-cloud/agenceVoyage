import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listGroupsForTrip, createGroup } from "@/lib/registrationGroups";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { tripId } = await params;
  const groups = await listGroupsForTrip(tripId);
  return NextResponse.json(groups);
}

export async function POST(request, { params }) {
  const session = await getSession();
  const canCreate =
    (await hasPermission(session, "inscriptions.create")) ||
    (await hasPermission(session, "inscriptions.edit"));
  if (!canCreate) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const { label, allowMixedGenderRoom } = await request.json();

  if (!label?.trim()) {
    return NextResponse.json({ message: "Le nom du groupe est requis" }, { status: 400 });
  }

  const id = await createGroup(tripId, label.trim(), allowMixedGenderRoom);
  return NextResponse.json({ id }, { status: 201 });
}
