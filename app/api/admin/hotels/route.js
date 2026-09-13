import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listHotels, createHotel } from "@/lib/hotels";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const hotels = await listHotels();
  return NextResponse.json(hotels);
}

export async function POST(request) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "suivi"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.name || !body.city) {
    return NextResponse.json(
      { message: "name et city sont requis" },
      { status: 400 }
    );
  }

  const id = await createHotel(body);
  return NextResponse.json({ id }, { status: 201 });
}
