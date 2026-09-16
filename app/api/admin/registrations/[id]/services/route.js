import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listRegistrationServices, addRegistrationService } from "@/lib/services";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const items = await listRegistrationServices(id);
  return NextResponse.json(items);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.services"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { serviceId, amount } = await request.json();

  if (!serviceId || amount == null) {
    return NextResponse.json(
      { message: "serviceId et amount sont requis" },
      { status: 400 }
    );
  }

  const insertId = await addRegistrationService(id, serviceId, amount);
  return NextResponse.json({ id: insertId }, { status: 201 });
}
