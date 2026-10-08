import { NextResponse } from "next/server";
import { createContactMessage } from "@/lib/contactMessages";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

async function POST_handler(request) {
  // Formulaire public : 5 messages / 10 min par adresse IP (NF-10).
  const limit = await rateLimit(`contact:${request.headers.get("x-agency-id")}:${clientIp(request)}`, { limit: 5, windowSeconds: 600 });
  if (!limit.ok) return tooManyRequests(NextResponse, 600);
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

export const POST = withNotFound(POST_handler);
