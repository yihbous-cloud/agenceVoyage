import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listServices, createService } from "@/lib/services";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const services = await listServices();
  return NextResponse.json(services);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "services.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { name, defaultPrice } = await request.json();
  if (!name) {
    return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  }

  const id = await createService({ name, defaultPrice });
  return NextResponse.json({ id }, { status: 201 });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
