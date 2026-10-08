import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "@/lib/secrets";
import { generateTotpSecret, verifyTotp, otpauthUrl, rolesRequiring2fa } from "@/lib/totp";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logAudit, requestIp } from "@/lib/audit";
import { assertOwned } from "@/lib/agencyContext";
import { readJson } from "@/lib/whatsapp/apiHelpers";

// Double authentification du compte connecté (activation, désactivation)
// et réinitialisation par un administrateur (téléphone perdu). Seule API
// admin accessible tant qu'un rôle soumis à la 2FA ne l'a pas activée.

export const dynamic = "force-dynamic";

async function loadUser(session) {
  const [u] = await query(
    `SELECT id, email, totp_secret_enc, totp_enabled_at FROM staff_users WHERE id = ? AND agency_id = ?`,
    [session.id, session.agencyId]
  );
  return u;
}

function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const user = await loadUser(session);
  return NextResponse.json({
    enabled: Boolean(user?.totp_enabled_at),
    enabledAt: user?.totp_enabled_at || null,
    required: rolesRequiring2fa().includes(session.role),
    encryptionConfigured: isEncryptionConfigured(),
  });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  const body = await readJson(request);
  const agencyId = session.agencyId;
  const ip = requestIp(request);

  if (body.action === "reset") {
    // Réinitialisation de la 2FA d'un autre compte (téléphone perdu).
    if (!(await hasPermission(session, "utilisateurs.manage"))) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
    const staffId = Number(body.staffId);
    await assertOwned("staff_users", staffId, agencyId);
    await query(`UPDATE staff_users SET totp_secret_enc = NULL, totp_enabled_at = NULL, failed_login_count = 0, locked_until = NULL WHERE id = ? AND agency_id = ?`, [staffId, agencyId]);
    await logAudit({ agencyId, staffId: session.id, action: "securite.2fa.reinitialisation", objectType: "staff_users", objectId: staffId, ip });
    return NextResponse.json({ ok: true });
  }

  const user = await loadUser(session);
  if (!user) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  if (body.action === "start") {
    if (user.totp_enabled_at) return NextResponse.json({ message: "La double authentification est déjà active." }, { status: 409 });
    if (!isEncryptionConfigured()) return NextResponse.json({ message: "SECRETS_ENCRYPTION_KEY n'est pas configurée sur le serveur." }, { status: 400 });
    const secret = generateTotpSecret();
    await query(`UPDATE staff_users SET totp_secret_enc = ? WHERE id = ? AND agency_id = ?`, [encryptSecret(secret), user.id, agencyId]);
    const [agency] = await query(`SELECT name FROM agencies WHERE id = ?`, [agencyId]);
    const url = otpauthUrl(secret, user.email, agency?.name || "Espace interne");
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    return NextResponse.json({ secret, otpauth: url, qr });
  }

  if (body.action === "confirm") {
    if (user.totp_enabled_at) return NextResponse.json({ message: "La double authentification est déjà active." }, { status: 409 });
    let secret = null;
    try {
      secret = user.totp_secret_enc ? decryptSecret(user.totp_secret_enc) : null;
    } catch {
      secret = null;
    }
    if (!secret) return NextResponse.json({ message: "Commencez par générer le code QR." }, { status: 400 });
    if (!verifyTotp(secret, body.code)) return NextResponse.json({ message: "Code de vérification invalide" }, { status: 400 });
    await query(`UPDATE staff_users SET totp_enabled_at = UTC_TIMESTAMP() WHERE id = ? AND agency_id = ?`, [user.id, agencyId]);
    await logAudit({ agencyId, staffId: user.id, action: "securite.2fa.activation", objectType: "staff_users", objectId: user.id, ip });
    // Nouvelle session : la 2FA vient d'être prouvée, l'accès complet est rétabli.
    const token = await createSessionToken({ ...session, mfa: true, mfaSetupRequired: false });
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);
    return response;
  }

  if (body.action === "disable") {
    if (!user.totp_enabled_at) return NextResponse.json({ message: "La double authentification n'est pas active." }, { status: 409 });
    if (rolesRequiring2fa().includes(session.role)) {
      return NextResponse.json({ message: "La double authentification est obligatoire pour votre rôle." }, { status: 403 });
    }
    let secret = null;
    try {
      secret = decryptSecret(user.totp_secret_enc);
    } catch {
      secret = null;
    }
    if (!secret || !verifyTotp(secret, body.code)) return NextResponse.json({ message: "Code de vérification invalide" }, { status: 400 });
    await query(`UPDATE staff_users SET totp_secret_enc = NULL, totp_enabled_at = NULL WHERE id = ? AND agency_id = ?`, [user.id, agencyId]);
    await logAudit({ agencyId, staffId: user.id, action: "securite.2fa.desactivation", objectType: "staff_users", objectId: user.id, ip });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
}
