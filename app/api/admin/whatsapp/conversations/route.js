import { NextResponse } from "next/server";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { listConversations } from "@/lib/whatsapp/conversations";

export const dynamic = "force-dynamic";

const INBOX = ["whatsapp.conversations.all", "whatsapp.conversations.own"];

// Liste de l'inbox (filtrée selon les droits : toutes ou son équipe).
export const GET = whatsappRoute(INBOX, async (request, _context, session) => {
  const p = request.nextUrl.searchParams;
  const rows = await listConversations(session, {
    status: p.get("status") || "ouvertes",
    mine: p.get("mine") === "1",
    reason: p.get("reason") || null,
    q: p.get("q") || null,
  });
  return NextResponse.json(rows);
});
