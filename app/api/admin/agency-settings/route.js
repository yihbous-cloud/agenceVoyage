import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getAgencySettings, updateAgencySettings, setAgencySocialLinks } from "@/lib/agencySettings";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const settings = await getAgencySettings();
  return NextResponse.json(settings);
}

async function PUT_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "parametres.edit"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ message: "Le nom de l'agence est requis" }, { status: 400 });
  }

  await updateAgencySettings(body);
  if (Array.isArray(body.socialLinks)) {
    await setAgencySocialLinks(body.socialLinks);
  }
  const updated = await getAgencySettings();
  return NextResponse.json(updated);
}

export const GET = withNotFound(GET_handler);
export const PUT = withNotFound(PUT_handler);
