import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getAccountForAgency, saveAccount } from "@/lib/whatsapp/accounts";
import { isEncryptionConfigured } from "@/lib/secrets";
import { logAudit, requestIp } from "@/lib/audit";
import { withNotFound } from "@/lib/apiGuard";

// Compte WhatsApp Business de l'agence courante. Les secrets ne sont JAMAIS
// renvoyés : seulement leur version masquée (4 derniers caractères).
function auditView(account) {
  if (!account) return null;
  const { verify_token, access_token_masked, app_secret_masked, ...rest } = account;
  return { ...rest, access_token: access_token_masked, app_secret: app_secret_masked };
}

async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.settings"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  return NextResponse.json(await getAccountForAgency());
}

async function PUT_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.settings"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const body = await request.json();
  if ((body.accessToken || body.appSecret) && !isEncryptionConfigured()) {
    return NextResponse.json(
      { message: "SECRETS_ENCRYPTION_KEY n'est pas configurée sur le serveur : impossible d'enregistrer un secret." },
      { status: 400 }
    );
  }
  const before = await getAccountForAgency();
  try {
    const after = await saveAccount(body);
    await logAudit({
      agencyId: session.agencyId,
      staffId: session.id,
      action: before ? "whatsapp.account.update" : "whatsapp.account.create",
      objectType: "wa_accounts",
      objectId: after.id,
      before: auditView(before),
      after: auditView(after),
      ip: requestIp(request),
    });
    return NextResponse.json(after);
  } catch (err) {
    if (err.code === "VALIDATION") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const PUT = withNotFound(PUT_handler);
