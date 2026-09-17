import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getVisaServiceRequestById, updateVisaServiceRequest } from "@/lib/visaServices";

export async function GET(request, { params }) {
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

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updated = await updateVisaServiceRequest(id, body);
  return NextResponse.json(updated);
}
