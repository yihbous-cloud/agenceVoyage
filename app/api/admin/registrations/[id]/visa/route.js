import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { assignVisaTypeToRegistration } from "@/lib/visaTypes";

export async function POST(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { visaTypeId } = await request.json();

  if (!visaTypeId) {
    return NextResponse.json({ message: "visaTypeId requis" }, { status: 400 });
  }

  await assignVisaTypeToRegistration(id, visaTypeId);
  return NextResponse.json({ ok: true });
}
