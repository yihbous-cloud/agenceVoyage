import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setVisaServiceDocumentStatus } from "@/lib/visaServices";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await request.json();
  await setVisaServiceDocumentStatus(id, status);
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
