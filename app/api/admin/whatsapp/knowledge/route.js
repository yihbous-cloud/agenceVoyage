import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import {
  listKnowledge,
  listUnanswered,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  markUnansweredHandled,
  sitePagesOfKnowledge,
} from "@/lib/ai/knowledge";
import { SITE_PAGES, SITE_PAGE_PATHS } from "@/lib/editorial";
import { refreshPublicPages } from "@/lib/publicRevalidation";

export const dynamic = "force-dynamic";

// Base de connaissances de l'agent (exigence 8.9) — aussi la banque de
// questions du site (vague 2B du référencement) : une fiche affichée sur /faq
// ou un pilier rafraîchit ces pages.
export const GET = whatsappRoute("ia.knowledge", async () =>
  NextResponse.json({ items: await listKnowledge(), unanswered: await listUnanswered() })
);

export const POST = whatsappRoute("ia.knowledge", async (request, _context, session) => {
  const body = await readJson(request);
  // Pages du site concernées avant et après l'écriture.
  const pages = new Set();
  if (body.action === "update" || body.action === "delete") {
    (await sitePagesOfKnowledge(body.id)).forEach((p) => pages.add(p));
  }
  if ((body.action === "create" || body.action === "update") && SITE_PAGES.includes(body.item?.sitePage)) {
    pages.add(body.item.sitePage);
  }
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
  if (pages.size > 0) {
    await refreshPublicPages({ paths: [...pages].map((page) => SITE_PAGE_PATHS[page]) });
  }
  return NextResponse.json({ items: await listKnowledge(), unanswered: await listUnanswered() });
});
