import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getAgencySettings, updateAgencySettings, setAgencySocialLinks, GTM_ID_PATTERN } from "@/lib/agencySettings";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages, findProgramIds } from "@/lib/publicRevalidation";

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
  // Informations légales et mesure d'audience (référencement, vague 1C).
  const gtm = String(body.gtmContainerId || "").trim().toUpperCase();
  if (gtm && !GTM_ID_PATTERN.test(gtm)) {
    return NextResponse.json(
      { message: "Identifiant Google Tag Manager invalide (format attendu : GTM-XXXXXXX)" },
      { status: 400 }
    );
  }
  if (body.foundingDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.foundingDate)) {
    return NextResponse.json({ message: "Date de création invalide" }, { status: 400 });
  }
  const limits = {
    legalName: 200,
    legalForm: 100,
    shareCapital: 100,
    publicationDirector: 150,
    licenseNumber: 100,
    insuranceInfo: 500,
    cndpNumber: 100,
    hostingProvider: 255,
    cgvFr: 200000,
    cgvAr: 200000,
  };
  for (const [key, max] of Object.entries(limits)) {
    if (body[key] && String(body[key]).trim().length > max) {
      return NextResponse.json({ message: `Texte trop long (${max} caractères maximum)` }, { status: 400 });
    }
  }

  await updateAgencySettings(body);
  if (Array.isArray(body.socialLinks)) {
    await setAgencySocialLinks(body.socialLinks);
  }
  const updated = await getAgencySettings();
  // Coordonnées, logo, réseaux sociaux : en-tête, pied de page et balisage
  // de toutes les pages publiques.
  await refreshPublicPages({ site: true });
  return NextResponse.json(updated);
}

export const GET = withNotFound(GET_handler);
export const PUT = withNotFound(PUT_handler);
