import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { autoAssignTrip } from "@/lib/roomAssignment";

export async function POST(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const result = await autoAssignTrip(tripId);
  return NextResponse.json(result);
}
