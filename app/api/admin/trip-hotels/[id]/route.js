import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { removeTripHotel } from "@/lib/roomAssignment";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages, findProgramIds } from "@/lib/publicRevalidation";

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "hebergement.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const programIds = await findProgramIds({ tripHotelId: id });
  await removeTripHotel(id);
  await refreshPublicPages({ programIds });
  return NextResponse.json({ ok: true });
}

export const DELETE = withNotFound(DELETE_handler);
