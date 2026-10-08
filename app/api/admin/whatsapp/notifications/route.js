import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listNotificationsForStaff, markNotificationsRead } from "@/lib/whatsapp/team";
import { readJson } from "@/lib/whatsapp/apiHelpers";

export const dynamic = "force-dynamic";

// Notifications de l'utilisateur connecté (cloche de l'en-tête et
// notifications du navigateur) : les siennes et celles de son équipe.
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  return NextResponse.json(await listNotificationsForStaff(session, { unreadOnly, limit: 30 }));
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const body = await readJson(request);
  await markNotificationsRead(session, Array.isArray(body.ids) ? body.ids.map(Number) : []);
  return NextResponse.json({ ok: true });
}
