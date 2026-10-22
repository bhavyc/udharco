import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionRole = "SELLER" | "ANCHOR" | "INVESTOR";
export type AdminSessionRole = "ADMIN";

export interface SessionPayload {
  userId: string;        // User.id
  role: SessionRole;
  entityId: string;      // Seller.id | Anchor.id | Investor.id
  mobile?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AdminSessionPayload {
  adminId: string;       // AdminUser.id
  email: string;
  role: AdminSessionRole;
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// Key derivation — separate secrets for user and admin sessions
// ---------------------------------------------------------------------------

const USER_SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "udharco_super_secure_user_jwt_secret_key_32bytes_min";
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  "udharco_super_secure_admin_jwt_secret_key_32bytes_min";

const userKey = new TextEncoder().encode(USER_SESSION_SECRET);
const adminKey = new TextEncoder().encode(ADMIN_SESSION_SECRET);

// ---------------------------------------------------------------------------
// Encrypt / Decrypt — User sessions
// ---------------------------------------------------------------------------

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(userKey);
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, userKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt — Admin sessions
// ---------------------------------------------------------------------------

export async function encryptAdminSession(
  payload: AdminSessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // Shorter expiry for admins
    .sign(adminKey);
}

export async function decryptAdminSession(
  token: string | undefined
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, adminKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = "udharco_session";
const ADMIN_COOKIE_NAME = "udharco_admin_session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/admin",
  maxAge: 8 * 60 * 60, // 8 hours
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return decryptSession(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function createAdminSession(
  payload: AdminSessionPayload
): Promise<void> {
  const token = await encryptAdminSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return decryptAdminSession(token);
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
