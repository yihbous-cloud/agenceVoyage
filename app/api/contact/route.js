import { NextResponse } from "next/server";
import { createContactMessage } from "@/lib/contactMessages";

export async function POST(request) {
  const body = await request.json();
  const { fullName, email, message } = body;

  if (!fullName || !email || !message) {
    return NextResponse.json(
      { message: "fullName, email et message sont requis" },
      { status: 400 }
    );
  }

  const id = await createContactMessage(body);
  return NextResponse.json({ id }, { status: 201 });
}
