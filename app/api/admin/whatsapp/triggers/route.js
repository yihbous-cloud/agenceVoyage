import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import {
  listTriggers,
  saveTrigger,
  setTriggerActive,
  deleteTrigger,
  simulateTrigger,
  launchManualTrigger,
  listRuns,
  seedDefaultTriggers,
} from "@/lib/whatsapp/triggers";
import { logAudit, requestIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Déclencheurs (écran 8.12, DC-01 à DC-10).
export const GET = whatsappRoute("whatsapp.triggers", async (request) => {
  const triggerId = request.nextUrl.searchParams.get("runs");
  if (triggerId) return NextResponse.json(await listRuns({ triggerId: triggerId === "all" ? null : Number(triggerId) }));
  return NextResponse.json(await listTriggers());
});

export const POST = whatsappRoute("whatsapp.triggers", async (request, _context, session) => {
  const body = await readJson(request);
  const audit = (action, objectId, after) =>
    logAudit({ agencyId: session.agencyId, staffId: session.id, action, objectType: "wa_triggers", objectId, after, ip: requestIp(request) });
  switch (body.action) {
    case "save": {
      const t = await saveTrigger(body.trigger || {});
      await audit("whatsapp.trigger.save", t.id, { name: t.name, family: t.family });
      return NextResponse.json(t);
    }
    case "toggle":
      await setTriggerActive(body.id, body.active === true);
      await audit("whatsapp.trigger.toggle", body.id, { active: body.active === true });
      return NextResponse.json({ ok: true });
    case "delete":
      await deleteTrigger(body.id);
      await audit("whatsapp.trigger.delete", body.id, null);
      return NextResponse.json({ ok: true });
    case "simulate":
      return NextResponse.json(await simulateTrigger(body.id));
    case "launch": {
      const planned = await launchManualTrigger(body.id, { tripId: Number(body.tripId), text: body.text || "" });
      await audit("whatsapp.trigger.launch", body.id, { tripId: body.tripId, planned });
      return NextResponse.json({ planned });
    }
    case "seed": {
      const created = await seedDefaultTriggers();
      await audit("whatsapp.trigger.seed", null, { created });
      return NextResponse.json({ created });
    }
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
});
