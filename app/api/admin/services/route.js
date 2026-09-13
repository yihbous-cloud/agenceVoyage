import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listServices, createService } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const services = await listServices();
  return NextResponse.json(services);
}

export async function POST(request) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "comptabilite"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { name, defaultPrice } = await request.json();
  if (!name) {
    return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  }

  const id = await createService({ name, defaultPrice });
  return NextResponse.json({ id }, { status: 201 });
}
