import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { withNotFound } from "@/lib/apiGuard";
import { decryptSecret } from "@/lib/secrets";
import { verifyTotp, rolesRequiring2fa } from "@/lib/totp";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

// Connexion à l'espace interne (NF-07) : mot de passe, puis code de double
// authentification si le compte l'a activée ; verrouillage 15 min après 5
// échecs consécutifs ; débit limité par adresse IP.

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const INVALID = { message: "Identifiants invalides" };

async function recordFailure(user, agencyId, request) {
  const count = Number(user.failed_login_count || 0) + 1;
  if (count >= MAX_FAILURES) {
    await query(
      `UPDATE staff_users SET failed_login_count = 0, locked_until = UTC_TIMESTAMP() + INTERVAL ${LOCK_MINUTES} MINUTE WHERE id = ? AND agency_id = ?`,
      [user.id, agencyId]
    );
    await logAudit({ agencyId, staffId: user.id, action: "connexion.verrouillage", objectType: "staff_users", objectId: user.id, ip: clientIp(request) });
  } else {
    await query(`UPDATE staff_users SET failed_login_count = ? WHERE id = ? AND agency_id = ?`, [count, user.id, agencyId]);
  }
}

async function POST_handler(request) {
  const { email, password, totp } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: "Email et mot de passe requis" }, { status: 400 });
  }

  // Agence résolue par proxy.js depuis le sous-domaine (jamais fournie par le
  // corps de la requête) — un compte n'existe que dans SON agence.
  const agencyId = Number(request.headers.get("x-agency-id"));
  if (!agencyId) {
    return NextResponse.json({ message: "Agence non résolue" }, { status: 400 });
  }

  const ip = clientIp(request);
  const limit = await rateLimit(`login:${agencyId}:${ip}`, { limit: 20, windowSeconds: 15 * 60 });
  if (!limit.ok) return tooManyRequests(NextResponse, 15 * 60);

  const rows = await query(
    `SELECT su.id, su.full_name, su.email, su.password_hash, su.is_active, su.approval_status, su.role_id AS roleId, r.name AS role,
       su.totp_secret_enc, su.totp_enabled_at, su.failed_login_count,
       su.locked_until > UTC_TIMESTAMP() AS locked, su.locked_until
     FROM staff_users su
     JOIN roles r ON r.id = su.role_id AND r.agency_id = su.agency_id
     WHERE su.email = ? AND su.agency_id = ?
     LIMIT 1`,
    [email, agencyId]
  );

  const user = rows[0];

  // Demande de compte (migration 041) : un compte en attente ou refusé passe
  // le contrôle du mot de passe AVANT d'afficher son état — sans le bon mot
  // de passe, réponse identique à un compte inexistant.
  const isRequest = user && user.approval_status !== "valide";
  if (!user || (!isRequest && !user.is_active)) {
    return NextResponse.json(INVALID, { status: 401 });
  }
  if (Number(user.locked)) {
    return NextResponse.json(
      { message: `Compte verrouillé après ${MAX_FAILURES} tentatives échouées. Réessayez dans ${LOCK_MINUTES} minutes.`, locked: true },
      { status: 423 }
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await recordFailure(user, agencyId, request);
    return NextResponse.json(INVALID, { status: 401 });
  }

  if (user.approval_status === "en_attente") {
    return NextResponse.json(
      { message: "Votre compte est en attente de validation par un administrateur.", pending: true },
      { status: 403 }
    );
  }
  if (isRequest) {
    return NextResponse.json(
      { message: "Votre demande de compte a été refusée. Contactez la direction de l'agence.", refused: true },
      { status: 403 }
    );
  }

  // Double authentification activée : code demandé (sans session tant qu'il
  // n'est pas valide).
  let mfa = false;
  if (user.totp_enabled_at && user.totp_secret_enc) {
    if (!totp) return NextResponse.json({ mfaRequired: true });
    let secret = null;
    try {
      secret = decryptSecret(user.totp_secret_enc);
    } catch {
      secret = null;
    }
    if (!secret || !verifyTotp(secret, totp)) {
      await recordFailure(user, agencyId, request);
      return NextResponse.json({ message: "Code de vérification invalide", mfaRequired: true }, { status: 401 });
    }
    mfa = true;
  }

  await query(`UPDATE staff_users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [
    user.id,
    agencyId,
  ]);

  const mfaSetupRequired = !mfa && rolesRequiring2fa().includes(user.role);
  const token = await createSessionToken({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    roleId: user.roleId,
    agencyId,
    mfa,
    mfaSetupRequired,
  });

  const response = NextResponse.json({
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    mfaSetupRequired,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  return response;
}

export const POST = withNotFound(POST_handler);
