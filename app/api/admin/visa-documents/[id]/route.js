import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { setDocumentStatus } from "@/lib/visaTypes";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!["manquant", "fourni"].includes(status)) {
    return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
  }

  await setDocumentStatus(id, status);
  return NextResponse.json({ ok: true });
}
