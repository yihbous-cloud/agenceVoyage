import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "gf_session";
const alg = "HS256";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET n'est pas défini dans .env");
  }
  return new TextEncoder().encode(secret);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken({ id, fullName, email, role, roleId, agencyId }) {
  return new SignJWT({ id, fullName, email, role, roleId, agencyId })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}
