import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listKnowledge, listUnanswered, createKnowledge, updateKnowledge, deleteKnowledge, markUnansweredHandled } from "@/lib/ai/knowledge";

export const dynamic = "force-dynamic";

// Base de connaissances de l'agent (exigence 8.9).
export const GET = whatsappRoute("ia.knowledge", async () =>
  NextResponse.json({ items: await listKnowledge(), unanswered: await listUnanswered() })
);

export const POST = whatsappRoute("ia.knowledge", async (request, _context, session) => {
  const body = await readJson(request);
  switch (body.action) {
    case "create":
      await createKnowledge(body.item || {}, session.id);
      break;
    case "update":
      await updateKnowledge(body.id, body.item || {});
      break;
    case "delete":
      await deleteKnowledge(body.id);
      break;
    case "dismiss":
      await markUnansweredHandled(body.id, null);
      break;
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
  return NextResponse.json({ items: await listKnowledge(), unanswered: await listUnanswered() });
});
