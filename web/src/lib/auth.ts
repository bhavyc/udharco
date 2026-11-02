import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { SessionRole } from "@/lib/session";
import { getSession, getAdminSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// requireAuth — call at the top of any API route handler that needs auth.
//
// Usage:
//   const auth = await requireAuth();
//   if (auth instanceof NextResponse) return auth; // 401 short-circuit
//   const { userId, role, entityId } = auth;
//
// Optionally restrict to one or more roles:
//   const auth = await requireAuth("SELLER");
//   const auth = await requireAuth(["ANCHOR", "INVESTOR"]);
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  role: SessionRole;
  entityId: string; // Seller.id | Anchor.id | Investor.id
}

export async function requireAuth(
  allowedRoles?: SessionRole | SessionRole[]
): Promise<AuthContext | NextResponse> {
  const headerStore = await headers();
  let userId = headerStore.get("x-user-id");
  let role = headerStore.get("x-user-role") as SessionRole | null;
  let entityId = headerStore.get("x-entity-id");

  // Fallback: verify cryptographic JWT session cookie directly if headers are not set
  if (!userId || !role || !entityId) {
    const session = await getSession();
    if (session) {
      userId = session.userId;
      role = session.role;
      entityId = session.entityId;
    }
  }

  if (!userId || !role || !entityId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  if (allowedRoles) {
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!allowed.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden. Required role: ${allowed.join(" or ")}.`,
        },
        { status: 403 }
      );
    }
  }

  return { userId, role, entityId };
}

// ---------------------------------------------------------------------------
// requireAdminAuth — for /admin/api routes and admin-protected v1 APIs.
// ---------------------------------------------------------------------------

export interface AdminAuthContext {
  adminId: string;
  email: string;
}

export async function requireAdminAuth(): Promise<
  AdminAuthContext | NextResponse
> {
  const headerStore = await headers();
  let adminId = headerStore.get("x-admin-id");
  let email = headerStore.get("x-admin-email");

  // Fallback: verify cryptographic admin JWT session cookie directly
  if (!adminId || !email) {
    const adminSession = await getAdminSession();
    if (adminSession) {
      adminId = adminSession.adminId;
      email = adminSession.email;
    }
  }

  if (!adminId || !email) {
    return NextResponse.json(
      { success: false, error: "Admin authentication required." },
      { status: 401 }
    );
  }

  return { adminId, email };
}
