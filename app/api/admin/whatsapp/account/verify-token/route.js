import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { regenerateVerifyToken } from "@/lib/whatsapp/accounts";
import { logAudit, requestIp } from "@/lib/audit";
import { withNotFound } from "@/lib/apiGuard";

// Nouveau jeton de vérification du webhook (à recopier ensuite dans Meta).
async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.settings"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const account = await regenerateVerifyToken();
  if (!account) return NextResponse.json({ message: "Aucun compte WhatsApp configuré" }, { status: 404 });
  await logAudit({
    agencyId: session.agencyId,
    staffId: session.id,
    action: "whatsapp.verify_token.regenerate",
    objectType: "wa_accounts",
    objectId: account.id,
    ip: requestIp(request),
  });
  return NextResponse.json(account);
}

export const POST = withNotFound(POST_handler);
