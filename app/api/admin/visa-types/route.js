import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listVisaTypes, createVisaType } from "@/lib/visaTypes";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const visaTypes = await listVisaTypes();
  return NextResponse.json(visaTypes);
}

export async function POST(request) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  }

  const id = await createVisaType(body);
  return NextResponse.json({ id }, { status: 201 });
}
