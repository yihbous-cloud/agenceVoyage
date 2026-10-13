import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateProgramMedia, deleteProgramMedia, programIdOfMedia } from "@/lib/programMedia";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages } from "@/lib/publicRevalidation";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  await updateProgramMedia(id, body);
  await refreshPublicPages({ programId: await programIdOfMedia(id) });
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const programId = await programIdOfMedia(id);
  await deleteProgramMedia(id);
  if (programId) await refreshPublicPages({ programId });
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
