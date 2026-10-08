import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { checkAccountConnection } from "@/lib/whatsapp/accounts";
import { withNotFound } from "@/lib/apiGuard";

// "Tester la connexion" : interroge Meta avec le jeton enregistré.
async function POST_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.settings"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const result = await checkAccountConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export const POST = withNotFound(POST_handler);
