import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateReview, deleteReview, programIdOfReview, listReviewsForProgram } from "@/lib/programReviews";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages } from "@/lib/publicRevalidation";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    await updateReview(id, body);
  } catch (err) {
    if (err.code === "VALIDATION") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
  const programId = await programIdOfReview(id);
  await refreshPublicPages({ programId });
  return NextResponse.json({ reviews: await listReviewsForProgram(programId) });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const programId = await programIdOfReview(id);
  await deleteReview(id);
  if (programId) await refreshPublicPages({ programId });
  return NextResponse.json({ reviews: programId ? await listReviewsForProgram(programId) : [] });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
