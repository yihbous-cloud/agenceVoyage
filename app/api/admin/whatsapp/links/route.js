import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listLinks, createLink, setLinkActive } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";

// Liens wa.me et QR codes (écran 8.7, CP-07).
export const GET = whatsappRoute("whatsapp.links", async () => NextResponse.json(await listLinks()));

export const POST = whatsappRoute("whatsapp.links", async (request, _context, session) => {
  const body = await readJson(request);
  if (body.action === "toggle") await setLinkActive(body.id, body.active === true);
  else await createLink(body.link || {}, session.id);
  return NextResponse.json(await listLinks());
});
