import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { runSandbox, listTestCases, saveTestCase, deleteTestCase, newRunKey, listTestRuns, getTestRun } from "@/lib/ai/sandbox";
import { isAiConfigured } from "@/lib/ai/client";
import { enqueue, QUEUES } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Bac à sable de l'agent (exigence 8.10) : simulation, rien n'est envoyé.
export const GET = whatsappRoute("ia.sandbox", async (request) => {
  const runKey = request.nextUrl.searchParams.get("run");
  if (runKey) return NextResponse.json(await getTestRun(runKey));
  return NextResponse.json({ cases: await listTestCases(), runs: await listTestRuns(), aiConfigured: isAiConfigured() });
});

export const POST = whatsappRoute("ia.sandbox", async (request, _context, session) => {
  const body = await readJson(request);
  switch (body.action) {
    case "chat": {
      if (!isAiConfigured()) {
        return NextResponse.json({ message: "Clé API Claude (ANTHROPIC_API_KEY) non configurée sur le serveur." }, { status: 409 });
      }
      const result = await runSandbox({
        history: body.history || [],
        travelerId: body.travelerId ? Number(body.travelerId) : null,
        settingsVersionId: body.settingsVersionId || null,
      });
      return NextResponse.json(result);
    }
    case "save-case":
      await saveTestCase(body.testCase || {});
      return NextResponse.json({ cases: await listTestCases() });
    case "delete-case":
      await deleteTestCase(body.id);
      return NextResponse.json({ cases: await listTestCases() });
    case "run-suite": {
      if (!isAiConfigured()) {
        return NextResponse.json({ message: "Clé API Claude (ANTHROPIC_API_KEY) non configurée sur le serveur." }, { status: 409 });
      }
      const runKey = newRunKey();
      const queued = await enqueue(QUEUES.ai, "test-suite", { agencyId: session.agencyId, runKey }, { jobId: `tests-${runKey.replace(/[^a-z0-9-]/gi, "")}`, attempts: 1 });
      if (!queued) return NextResponse.json({ message: "File d'attente indisponible (Redis / worker)." }, { status: 503 });
      return NextResponse.json({ runKey });
    }
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
});
