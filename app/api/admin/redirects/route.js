import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listRedirects, createRedirect } from "@/lib/redirects";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit } from "@/lib/audit";
import { resolveAgencyId } from "@/lib/agencyContext";

// Redirections 301 publiques (CLAUDE.md §3centquatorzequadragies) — onglet
// « Redirections » de /admin/referencement.

async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "seo.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  return NextResponse.json(await listRedirects());
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "seo.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const saved = await createRedirect({
      fromPath: body.fromPath,
      toPath: body.toPath,
      source: "manuel",
      staffId: session?.id || null,
    });
    await logAudit({
      agencyId: await resolveAgencyId(),
      staffId: session?.id || null,
      action: "redirection.creation",
      objectType: "redirect",
      objectId: null,
      after: saved,
    }).catch(() => {});
    return NextResponse.json(await listRedirects(), { status: 201 });
  } catch (err) {
    if (err?.code === "INVALID_REDIRECT") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
