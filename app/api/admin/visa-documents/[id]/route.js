import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setDocumentStatus } from "@/lib/visaTypes";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_documents.manage"))) {
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
