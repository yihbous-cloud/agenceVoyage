import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAirlines, createAirline } from "@/lib/airlines";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const airlines = await listAirlines();
  return NextResponse.json(airlines);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "compagnies.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  }

  try {
    const id = await createAirline(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Cette compagnie existe déjà" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
