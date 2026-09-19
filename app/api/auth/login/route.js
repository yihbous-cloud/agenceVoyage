import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email et mot de passe requis" },
      { status: 400 }
    );
  }

  // Agence résolue par proxy.js depuis le sous-domaine (jamais fournie par le
  // corps de la requête) — un compte n'existe que dans SON agence.
  const agencyId = Number(request.headers.get("x-agency-id"));
  if (!agencyId) {
    return NextResponse.json({ message: "Agence non résolue" }, { status: 400 });
  }

  const rows = await query(
    `SELECT su.id, su.full_name, su.email, su.password_hash, su.is_active, su.role_id AS roleId, r.name AS role
     FROM staff_users su
     JOIN roles r ON r.id = su.role_id AND r.agency_id = su.agency_id
     WHERE su.email = ? AND su.agency_id = ?
     LIMIT 1`,
    [email, agencyId]
  );

  const user = rows[0];

  if (!user || !user.is_active) {
    return NextResponse.json(
      { message: "Identifiants invalides" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { message: "Identifiants invalides" },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    roleId: user.roleId,
    agencyId,
  });

  const response = NextResponse.json({
    id: user.id,
    fullName: user.full_name,
    role: user.role,
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
