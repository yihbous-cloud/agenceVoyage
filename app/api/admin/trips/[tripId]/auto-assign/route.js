import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { autoAssignTrip } from "@/lib/roomAssignment";
import { withNotFound } from "@/lib/apiGuard";

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { tripId } = await params;
  const result = await autoAssignTrip(tripId);
  return NextResponse.json(result);
}

export const POST = withNotFound(POST_handler);
