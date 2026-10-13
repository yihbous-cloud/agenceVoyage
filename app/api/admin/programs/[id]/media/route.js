import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listProgramMedia, createProgramMedia, reorderProgramMedia } from "@/lib/programMedia";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages } from "@/lib/publicRevalidation";

// Photos et vidéo d'une fiche voyage (vague 2A, CLAUDE.md §3centdixseptquadragies).
async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await listProgramMedia(id));
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    const mediaId = await createProgramMedia(id, body);
    await refreshPublicPages({ programId: id });
    return NextResponse.json({ id: mediaId, media: await listProgramMedia(id) }, { status: 201 });
  } catch (err) {
    if (err.code === "VALIDATION") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

// Nouvel ordre d'affichage : { order: [id, id, ...] }.
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  await reorderProgramMedia(id, Array.isArray(body.order) ? body.order : []);
  await refreshPublicPages({ programId: id });
  return NextResponse.json({ media: await listProgramMedia(id) });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
export const PUT = withNotFound(PUT_handler);
