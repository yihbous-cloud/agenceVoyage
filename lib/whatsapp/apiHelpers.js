import { NextResponse } from "next/server";
import { getSession } from "../session";
import { hasPermission } from "../permissions";
import { GraphApiError } from "./graph";

// Utilitaires communs aux routes /api/admin/whatsapp/* : contrôle de
// permission (côté serveur, NF-08) et traduction des erreurs métier en
// réponses HTTP lisibles par l'interface.

// permissions : un code, ou une liste (au moins une suffit).
export async function requireAny(permissions) {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ message: "Non autorisé" }, { status: 401 }) };
  const list = Array.isArray(permissions) ? permissions : [permissions];
  for (const code of list) {
    if (await hasPermission(session, code)) return { session };
  }
  return { response: NextResponse.json({ message: "Non autorisé" }, { status: 403 }) };
}

const STATUS_BY_CODE = {
  VALIDATION: 400,
  WINDOW_CLOSED: 409,
  BLOCKED: 409,
  NOT_CONFIGURED: 409,
  CONFLICT: 409,
  NOT_FOUND: 404,
};

export function errorResponse(err) {
  if (err?.code === "NOT_FOUND") return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
  if (STATUS_BY_CODE[err?.code]) return NextResponse.json({ message: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code] });
  if (err instanceof GraphApiError) {
    return NextResponse.json({ message: `WhatsApp (Meta) : ${err.message}` }, { status: 502 });
  }
  throw err;
}

// Enveloppe une route : (request, context, session) => réponse.
export function whatsappRoute(permissions, handler) {
  return async (request, context) => {
    const { session, response } = await requireAny(permissions);
    if (response) return response;
    try {
      return await handler(request, context, session);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
