import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getVisaServiceRequestById, updateVisaServiceRequest } from "@/lib/visaServices";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const item = await getVisaServiceRequestById(id);
  if (!item) {
    return NextResponse.json({ message: "Demande introuvable" }, { status: 404 });
  }
  return NextResponse.json(item);
}

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updated = await updateVisaServiceRequest(id, body);
  return NextResponse.json(updated);
}

export const GET = withNotFound(GET_handler);
export const PUT = withNotFound(PUT_handler);
