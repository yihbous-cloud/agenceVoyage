import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateVisaType, deleteVisaType } from "@/lib/visaTypes";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_types.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  await updateVisaType(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_types.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteVisaType(id);
  return NextResponse.json({ ok: true });
}
