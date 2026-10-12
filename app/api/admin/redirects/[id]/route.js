import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { deleteRedirect, listRedirects } from "@/lib/redirects";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit } from "@/lib/audit";
import { resolveAgencyId } from "@/lib/agencyContext";

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "seo.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  await deleteRedirect(id);
  await logAudit({
    agencyId: await resolveAgencyId(),
    staffId: session?.id || null,
    action: "redirection.suppression",
    objectType: "redirect",
    objectId: Number(id),
  }).catch(() => {});
  return NextResponse.json(await listRedirects());
}

export const DELETE = withNotFound(DELETE_handler);
