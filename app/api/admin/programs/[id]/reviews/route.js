import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listReviewsForProgram, createReview } from "@/lib/programReviews";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages } from "@/lib/publicRevalidation";

// Avis clients d'une fiche voyage (vague 2A, CLAUDE.md §3centdixseptquadragies).
async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await listReviewsForProgram(id));
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    const reviewId = await createReview(id, body, session.id);
    await refreshPublicPages({ programId: id });
    return NextResponse.json({ id: reviewId, reviews: await listReviewsForProgram(id) }, { status: 201 });
  } catch (err) {
    if (err.code === "VALIDATION") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
