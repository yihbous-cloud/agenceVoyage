import { NextResponse } from "next/server";
import { createContactMessage } from "@/lib/contactMessages";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { resolveLeadSource } from "@/lib/leadSource";

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

  // Source de la demande : le navigateur n'envoie que sa première visite,
  // le canal est classé ici (lib/leadSource.js).
  const lead = resolveLeadSource(body.leadSource, request.headers.get("host"));
  const id = await createContactMessage({
    fullName,
    email,
    message,
    phone: body.phone,
    subject: body.subject,
    ...lead,
  });
  return NextResponse.json({ id }, { status: 201 });
}

export const POST = withNotFound(POST_handler);
