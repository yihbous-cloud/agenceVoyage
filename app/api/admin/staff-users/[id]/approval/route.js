import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { reviewSignupRequest } from "@/lib/staffUsers";
import { withNotFound } from "@/lib/apiGuard";
import { logAudit, requestIp } from "@/lib/audit";

// Validation (avec le rôle choisi par l'administrateur) ou refus d'une
// demande de compte faite depuis /admin/demande-compte (migration 041).
async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "utilisateurs.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = body.decision;
  if (decision !== "valider" && decision !== "refuser") {
    return NextResponse.json({ message: "Décision invalide" }, { status: 400 });
  }
  if (decision === "valider" && !body.roleId) {
    return NextResponse.json({ message: "Choisissez le rôle du compte" }, { status: 400 });
  }

  try {
    await reviewSignupRequest(id, { decision, roleId: body.roleId, reviewerId: session.id });
  } catch (err) {
    if (err?.code === "ALREADY_VALIDATED") {
      return NextResponse.json({ message: "Ce compte est déjà validé" }, { status: 409 });
    }
    throw err;
  }

  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: decision === "valider" ? "utilisateur.validation" : "utilisateur.refus",
    objectType: "staff_users",
    objectId: id,
    after: decision === "valider" ? { roleId: body.roleId } : null,
    ip: requestIp(request),
  });
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
