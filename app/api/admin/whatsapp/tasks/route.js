import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { setTaskStatus, markNotificationsRead } from "@/lib/whatsapp/team";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ANY = ["whatsapp.tasks", "whatsapp.conversations.all", "whatsapp.conversations.own"];

// Tâches (reçus à valider, rappels, documents) et notifications internes.
export const POST = whatsappRoute(ANY, async (request, _context, session) => {
  const body = await readJson(request);
  if (body.action === "task-status") {
    if (!(await hasPermission(session, "whatsapp.tasks"))) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    await setTaskStatus(body.id, body.status, session.id);
  } else if (body.action === "notifications-read") {
    await markNotificationsRead(session, body.ids || []);
  } else {
    return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
});
