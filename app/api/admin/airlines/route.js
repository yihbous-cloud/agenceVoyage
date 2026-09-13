import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listAirlines, createAirline } from "@/lib/airlines";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const airlines = await listAirlines();
  return NextResponse.json(airlines);
}

export async function POST(request) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
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
