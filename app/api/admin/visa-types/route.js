import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listVisaTypes, createVisaType } from "@/lib/visaTypes";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const visaTypes = await listVisaTypes();
  return NextResponse.json(visaTypes);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "visa_types.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  }

  const id = await createVisaType(body);
  return NextResponse.json({ id }, { status: 201 });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
