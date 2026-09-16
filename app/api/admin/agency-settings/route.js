import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getAgencySettings, updateAgencySettings } from "@/lib/agencySettings";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const settings = await getAgencySettings();
  return NextResponse.json(settings);
}

export async function PUT(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "parametres.edit"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ message: "Le nom de l'agence est requis" }, { status: 400 });
  }

  const updated = await updateAgencySettings(body);
  return NextResponse.json(updated);
}
