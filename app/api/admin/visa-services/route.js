import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listVisaServiceRequests, createVisaServiceRequest } from "@/lib/visaServices";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const requests = await listVisaServiceRequests();
  return NextResponse.json(requests);
}

export async function POST(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, phoneWhatsapp, visaTypeId } = body;

  if (!fullName?.trim() || !phoneWhatsapp?.trim() || !visaTypeId) {
    return NextResponse.json(
      { message: "Le nom, le numéro WhatsApp et le type de visa sont requis" },
      { status: 400 }
    );
  }

  try {
    const id = await createVisaServiceRequest(body, session.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
